#!/usr/bin/env ucode
// SPDX-License-Identifier: GPL-2.0-or-later
// Multi-stage TSPU / censorship block classifier (DNS -> TCP -> TLS -> 16KB byte-cap).

let fs = require("fs");
let common = require("core.common");
let uci = require("core.uci");
let ip = require("core.ip");

let as_string = common.as_string;

const BLOCKED_VERDICT_META = {
    ok: { severity: "none", recommended_action: "none" },
    uplink_down: { severity: "error", recommended_action: "check_wan_uplink" },
    dns_blocked: { severity: "blocked", recommended_action: "encrypted_dns_or_proxy" },
    dns_spoofed: { severity: "blocked", recommended_action: "encrypted_dns_or_proxy" },
    tcp_blocked: { severity: "blocked", recommended_action: "route_via_connection" },
    clock_skew: { severity: "error", recommended_action: "sync_system_clock" },
    tls_cert_intercepted: { severity: "blocked", recommended_action: "encrypted_dns_and_connection" },
    tls_hello_blocked: { severity: "blocked", recommended_action: "connection_or_dpi" },
    tspu_byte_cap_16kb: { severity: "blocked", recommended_action: "connection_or_dpi" },
    slow_link: { severity: "warning", recommended_action: "check_link_or_switch_outbound" },
    http_restricted: { severity: "warning", recommended_action: "switch_exit_geo_or_connection" },
    probe_error: { severity: "warning", recommended_action: "retry_or_inspect_logs" }
};

function failure(error) {
    return { success: false, error };
}

function shell_quote(value) {
    return "'" + replace(as_string(value), /'/g, "'\\''") + "'";
}

function last_index_of(text, ch) {
    text = as_string(text);
    for (let i = length(text) - 1; i >= 0; i--) {
        if (substr(text, i, 1) == ch)
            return i;
    }
    return -1;
}

function valid_domain(value) {
    if (type(value) != "string")
        return false;
    if (value == "" || length(value) > 253)
        return false;
    if (ip.valid_ip(value) || substr(value, 0, 1) == "[" || index(value, ":") >= 0)
        return false;
    if (!match(value, /^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$/))
        return false;
    if (index(value, ".") <= 0 || index(value, "..") >= 0 || match(value, /^[0-9.]+$/))
        return false;

    let lowered = lc(value);
    if (match(lowered, /\.(local|lan|localhost|internal|home|arpa|invalid|test)$/))
        return false;

    let labels = split(lowered, ".");
    if (length(labels) < 2)
        return false;

    for (let label in labels) {
        let len = length(label);
        if (len < 1 || len > 63)
            return false;
        if (substr(label, 0, 1) == "-" || substr(label, len - 1, 1) == "-")
            return false;
    }

    let tld = labels[length(labels) - 1];
    if (match(tld, /^[0-9]+$/))
        return false;

    return true;
}

function is_bogon_or_private_ip(addr) {
    addr = as_string(addr);
    if (addr == "")
        return false;
    if (substr(addr, 0, 1) == "[" && substr(addr, length(addr) - 1, 1) == "]")
        addr = substr(addr, 1, length(addr) - 2);

    if (ip.is_disallowed_remote_ip(addr))
        return true;

    if (ip.valid_ipv4(addr, false, false)) {
        return ip.ip_in_cidr(addr, "10.0.0.0/8") ||
            ip.ip_in_cidr(addr, "100.64.0.0/10") ||
            ip.ip_in_cidr(addr, "172.16.0.0/12") ||
            ip.ip_in_cidr(addr, "192.0.0.0/24") ||
            ip.ip_in_cidr(addr, "192.0.2.0/24") ||
            ip.ip_in_cidr(addr, "192.168.0.0/16") ||
            ip.ip_in_cidr(addr, "198.18.0.0/15") ||
            ip.ip_in_cidr(addr, "198.51.100.0/24") ||
            ip.ip_in_cidr(addr, "203.0.113.0/24") ||
            ip.ip_in_cidr(addr, "240.0.0.0/4");
    }

    let v6 = ip.ipv6_words(addr);
    if (v6 != null) {
        if (v6[0] == 0 && v6[1] == 0 && v6[2] == 0 && v6[3] == 0 && v6[4] == 0 && v6[5] == 0xffff) {
            let mapped = sprintf("%d.%d.%d.%d", (v6[6] >> 8) & 0xff, v6[6] & 0xff, (v6[7] >> 8) & 0xff, v6[7] & 0xff);
            return is_bogon_or_private_ip(mapped);
        }
        return ip.ip_in_cidr(addr, "fc00::/7") ||
            ip.ip_in_cidr(addr, "2001:db8::/32") ||
            ip.ip_in_cidr(addr, "100::/64");
    }

    return false;
}

function parse_resolve_override(domain) {
    let raw = trim(as_string(getenv("FORKOP_TSPU_RESOLVE_HOST_PORT") || ""));
    if (raw == "")
        return null;

    if (match(raw, /^[0-9]+$/)) {
        let port = int(raw, 10);
        if (port >= 1 && port <= 65535)
            return { ip: "127.0.0.1", port };
        return null;
    }

    if (substr(raw, 0, 1) == "[") {
        let close = index(raw, "]:");
        if (close > 1) {
            let host_ip = substr(raw, 1, close - 1);
            let port_str = substr(raw, close + 2);
            if (ip.valid_ipv6(host_ip) && match(port_str, /^[0-9]+$/)) {
                let port = int(port_str, 10);
                if (port >= 1 && port <= 65535)
                    return { ip: "[" + host_ip + "]", port };
            }
        }
        return null;
    }

    let parts = split(raw, ":");
    if (length(parts) == 3 && parts[0] == domain && match(parts[1], /^[0-9]+$/) && ip.valid_ipv4(parts[2], false, false)) {
        let port = int(parts[1], 10);
        if (port >= 1 && port <= 65535)
            return { ip: parts[2], port };
    }

    let colon = last_index_of(raw, ":");
    if (colon > 0) {
        let host_ip = substr(raw, 0, colon);
        let port_str = substr(raw, colon + 1);
        if (ip.valid_ip(host_ip) && match(port_str, /^[0-9]+$/)) {
            let port = int(port_str, 10);
            if (port >= 1 && port <= 65535)
                return { ip: ip.valid_ipv6(host_ip) ? "[" + host_ip + "]" : host_ip, port };
        }
    }

    return null;
}

function resolve_section_proxy(section) {
    if (section == null || section == "" || section == "direct")
        return { ok: true, is_proxy: false, label: "direct" };

    if (type(section) != "string" || !match(section, /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/))
        return { ok: false, error: "invalid_section" };

    let cfg_name = getenv("FORKOP_CONFIG_NAME") || "forkop";
    let sec_cfg = uci.get_all(cfg_name, section);
    if (type(sec_cfg) != "object" || sec_cfg == null)
        return { ok: false, error: "section_probe_unavailable" };

    if (common.option(sec_cfg, "enabled", "1") == "0")
        return { ok: false, error: "section_probe_unavailable" };

    if (!common.bool_option(sec_cfg, "mixed_proxy_enabled", false))
        return { ok: false, error: "section_probe_unavailable" };

    let port_str = common.option(sec_cfg, "mixed_proxy_port", "");
    if (!match(port_str, /^[0-9]+$/))
        return { ok: false, error: "section_probe_unavailable" };

    let port = int(port_str, 10);
    if (port < 1 || port > 65535)
        return { ok: false, error: "section_probe_unavailable" };

    let auth = null;
    if (common.bool_option(sec_cfg, "mixed_proxy_auth_enabled", false)) {
        let user = common.option(sec_cfg, "mixed_proxy_username", "");
        let pass = common.option(sec_cfg, "mixed_proxy_password", "");
        if (user != "")
            auth = user + ":" + pass;
    }

    return {
        ok: true,
        is_proxy: true,
        label: section,
        port,
        auth
    };
}

function run_curl_json(args) {
    let curl_bin = getenv("FORKOP_TSPU_CURL_BIN") || "curl";
    let quoted = [ shell_quote(curl_bin) ];
    for (let arg in args)
        push(quoted, shell_quote(arg));

    let pipe = fs.popen(join(" ", quoted) + " 2>/dev/null", "r");
    if (!pipe)
        return { ok: false, exitcode: -1, meta: {} };

    let raw = pipe.read("all");
    let status = int(pipe.close());
    if (status > 255)
        status = int(status / 256);

    let meta = {};
    if (raw != null && trim(raw) != "") {
        try {
            let parsed = json(raw);
            if (type(parsed) == "object" && parsed != null)
                meta = parsed;
        }
        catch (e) {}
    }

    let exitcode = meta.exitcode != null ? int(meta.exitcode) : status;
    return {
        ok: true,
        exitcode,
        status,
        meta
    };
}

function check_wan_uplink() {
    let raw_targets = trim(as_string(getenv("FORKOP_TSPU_UPLINK_TARGETS") || ""));
    if (raw_targets == "up" || raw_targets == "none")
        return true;
    if (raw_targets == "down")
        return false;

    let targets = raw_targets != ""
        ? split(raw_targets, /[, \t]+/)
        : [ "https://1.1.1.1/", "https://8.8.8.8/" ];

    let checked = 0;
    for (let target in targets) {
        target = trim(as_string(target));
        if (target == "")
            continue;
        if (index(target, "://") < 0)
            target = "https://" + target + "/";
        checked++;
        let args = [
            "-sS",
            "-o", "/dev/null",
            "--noproxy", "*",
            "--proto", "=https",
            "--tlsv1.2",
            "--connect-timeout", "2",
            "--max-time", "3",
            "-w", "%{json}",
            target
        ];
        let test_ca = trim(as_string(getenv("FORKOP_TSPU_TEST_CACERT") || ""));
        if (test_ca != "") {
            push(args, "--cacert");
            push(args, test_ca);
        }
        let res = run_curl_json(args);
        if (!res.ok)
            continue;
        let m = res.meta;
        let code = res.exitcode;
        if (code == 0 || int(m.num_connects || 0) > 0 || (m.time_connect || 0) > 0 || index([35, 51, 58, 59, 60], code) >= 0)
            return true;
        if (checked >= 2)
            break;
    }

    return checked == 0;
}

function ms(seconds_val) {
    return seconds_val != null ? int((seconds_val * 1000) + 0.5) : 0;
}

function build_verdict_result(domain, section_label, verdict, remote_ip, http_code, bytes_read, stages) {
    let info = BLOCKED_VERDICT_META[verdict] || BLOCKED_VERDICT_META.probe_error;
    return {
        domain,
        section: section_label,
        checked_at: int(time()),
        verdict,
        severity: info.severity,
        recommended_action: info.recommended_action,
        remote_ip: as_string(remote_ip || ""),
        http_code: int(http_code || 0),
        bytes_read: int(bytes_read || 0),
        stages,
        comparison: null
    };
}

function run_single_probe(domain, raw_section) {
    let proxy_cfg = resolve_section_proxy(raw_section);
    if (!proxy_cfg.ok)
        return failure(proxy_cfg.error);

    let args = [
        "-sS",
        "-o", "/dev/null",
        "--proto", "=https",
        "--proto-redir", "=https",
        "--tlsv1.2",
        "-L",
        "--max-redirs", "2",
        "--range", "0-65535",
        "--connect-timeout", "4",
        "--max-time", "10",
        "--speed-time", "5",
        "--speed-limit", "256",
        "-w", "%{json}"
    ];

    let test_ca = trim(as_string(getenv("FORKOP_TSPU_TEST_CACERT") || ""));
    if (test_ca != "") {
        push(args, "--cacert");
        push(args, test_ca);
    }

    let target_url = "https://" + domain + "/";
    if (proxy_cfg.is_proxy) {
        push(args, "--socks5-hostname");
        push(args, "127.0.0.1:" + proxy_cfg.port);
        if (proxy_cfg.auth != null) {
            push(args, "--proxy-user");
            push(args, proxy_cfg.auth);
        }
    }
    else {
        push(args, "--noproxy");
        push(args, "*");
        let ov = parse_resolve_override(domain);
        if (ov != null) {
            push(args, "--resolve");
            push(args, sprintf("%s:%d:%s", domain, ov.port, ov.ip));
            if (ov.port != 443)
                target_url = sprintf("https://%s:%d/", domain, ov.port);
        }
    }

    push(args, target_url);

    let res = run_curl_json(args);
    if (!res.ok)
        return failure("probe_unavailable");

    let m = res.meta;
    let exitcode = int(res.exitcode);
    let errormsg = as_string(m.errormsg || "");
    let remote_ip = proxy_cfg.is_proxy ? "" : as_string(m.remote_ip || "");
    let http_code = int(m.response_code != null ? m.response_code : (m.http_code || 0));
    let size_download = int(m.size_download || 0);
    let speed_download = m.speed_download || 0;
    let time_namelookup = m.time_namelookup || 0;
    let time_connect = m.time_connect || 0;
    let time_appconnect = m.time_appconnect || 0;
    let time_total = m.time_total || 0;
    let num_connects = int(m.num_connects || 0);

    // Fail-closed if local section mixed_proxy listener itself refused connection.
    if (proxy_cfg.is_proxy && exitcode == 7 && (num_connects == 0 || index(errormsg, "127.0.0.1") >= 0))
        return failure("section_probe_unavailable");

    // Stage 1: DNS
    if (exitcode == 6 || (proxy_cfg.is_proxy && exitcode == 97 && match(lc(errormsg), /(resolve|host unreachable|name or service)/))) {
        let verdict = (!proxy_cfg.is_proxy && !check_wan_uplink()) ? "uplink_down" : "dns_blocked";
        let stages = [
            { stage: "dns", status: "failed", verdict, duration_ms: ms(time_namelookup || time_total) },
            { stage: "tcp", status: "skipped" },
            { stage: "tls", status: "skipped" },
            { stage: "byte_cap", status: "skipped" }
        ];
        return { success: true, data: build_verdict_result(domain, proxy_cfg.label, verdict, remote_ip, 0, 0, stages) };
    }

    let allow_local = getenv("FORKOP_TSPU_ALLOW_LOCAL_TEST") == "1";
    if (!proxy_cfg.is_proxy && !allow_local && remote_ip != "" && is_bogon_or_private_ip(remote_ip)) {
        let stages = [
            { stage: "dns", status: "failed", verdict: "dns_spoofed", remote_ip, duration_ms: ms(time_namelookup) },
            { stage: "tcp", status: "skipped" },
            { stage: "tls", status: "skipped" },
            { stage: "byte_cap", status: "skipped" }
        ];
        return { success: true, data: build_verdict_result(domain, proxy_cfg.label, "dns_spoofed", remote_ip, 0, 0, stages) };
    }

    let dns_stage = { stage: "dns", status: "ok", remote_ip, duration_ms: ms(time_namelookup) };

    // Stage 2: TCP
    let tcp_connected = (time_connect > 0 || num_connects > 0 || time_appconnect > 0 || http_code > 0 || size_download > 0 ||
        exitcode == 0 || index([18, 35, 51, 52, 56, 58, 59, 60], exitcode) >= 0);

    if (!tcp_connected && index([7, 28, 97], exitcode) >= 0) {
        let stages = [
            dns_stage,
            { stage: "tcp", status: "failed", verdict: "tcp_blocked", exitcode, duration_ms: ms(time_total) },
            { stage: "tls", status: "skipped" },
            { stage: "byte_cap", status: "skipped" }
        ];
        return { success: true, data: build_verdict_result(domain, proxy_cfg.label, "tcp_blocked", remote_ip, 0, 0, stages) };
    }

    let tcp_stage = { stage: "tcp", status: "ok", duration_ms: ms(time_connect) };

    // Stage 3: TLS
    let tls_connected = (time_appconnect > 0 || http_code > 0 || size_download > 0 || exitcode == 0 || exitcode == 18);
    if (!tls_connected) {
        let verdict = "probe_error";
        if (index([51, 58, 59, 60], exitcode) >= 0)
            verdict = int(time()) < 1700000000 ? "clock_skew" : "tls_cert_intercepted";
        else if (index([28, 35, 52, 56], exitcode) >= 0)
            verdict = "tls_hello_blocked";

        let stages = [
            dns_stage,
            tcp_stage,
            { stage: "tls", status: "failed", verdict, exitcode, duration_ms: ms(time_total) },
            { stage: "byte_cap", status: "skipped" }
        ];
        return { success: true, data: build_verdict_result(domain, proxy_cfg.label, verdict, remote_ip, 0, 0, stages) };
    }

    let tls_stage = { stage: "tls", status: "ok", duration_ms: ms(time_appconnect) };

    // Stage 4: 64KB Range Transfer / TSPU 16KB Byte-Cap Detection
    if (index([18, 28, 52, 56], exitcode) >= 0 && size_download >= 8192 && size_download <= 49152) {
        let stages = [
            dns_stage,
            tcp_stage,
            tls_stage,
            {
                stage: "byte_cap",
                status: "failed",
                verdict: "tspu_byte_cap_16kb",
                exitcode,
                bytes_read: size_download,
                http_code,
                duration_ms: ms(time_total)
            }
        ];
        return {
            success: true,
            data: build_verdict_result(domain, proxy_cfg.label, "tspu_byte_cap_16kb", remote_ip, http_code, size_download, stages)
        };
    }

    if (exitcode == 28 && size_download > 49152 && speed_download >= 1024) {
        let stages = [
            dns_stage,
            tcp_stage,
            tls_stage,
            {
                stage: "byte_cap",
                status: "warning",
                verdict: "slow_link",
                exitcode,
                bytes_read: size_download,
                http_code,
                duration_ms: ms(time_total)
            }
        ];
        return {
            success: true,
            data: build_verdict_result(domain, proxy_cfg.label, "slow_link", remote_ip, http_code, size_download, stages)
        };
    }

    if (exitcode == 0 && (http_code == 403 || http_code == 451)) {
        let stages = [
            dns_stage,
            tcp_stage,
            tls_stage,
            {
                stage: "byte_cap",
                status: "warning",
                verdict: "http_restricted",
                bytes_read: size_download,
                http_code,
                duration_ms: ms(time_total)
            }
        ];
        return {
            success: true,
            data: build_verdict_result(domain, proxy_cfg.label, "http_restricted", remote_ip, http_code, size_download, stages)
        };
    }

    if (exitcode == 0) {
        let verified_64kb = size_download >= 60160;
        let small_response = size_download < 16384;
        let stages = [
            dns_stage,
            tcp_stage,
            tls_stage,
            {
                stage: "byte_cap",
                status: "ok",
                verdict: "ok",
                bytes_read: size_download,
                http_code,
                verified_64kb,
                small_response,
                duration_ms: ms(time_total)
            }
        ];
        return {
            success: true,
            data: build_verdict_result(domain, proxy_cfg.label, "ok", remote_ip, http_code, size_download, stages)
        };
    }

    let stages = [
        dns_stage,
        tcp_stage,
        tls_stage,
        {
            stage: "byte_cap",
            status: "failed",
            verdict: "probe_error",
            exitcode,
            bytes_read: size_download,
            http_code,
            duration_ms: ms(time_total)
        }
    ];
    return {
        success: true,
        data: build_verdict_result(domain, proxy_cfg.label, "probe_error", remote_ip, http_code, size_download, stages)
    };
}

function handle(payload) {
    if (type(payload) != "object" || payload == null)
        return failure("invalid_payload");

    let raw_domain = payload.domain;
    if (!valid_domain(raw_domain))
        return failure("invalid_domain");

    let domain = lc(raw_domain);
    let primary = run_single_probe(domain, payload.section);
    if (!primary.success)
        return primary;

    let compare_section = payload.compare_section != null ? trim(as_string(payload.compare_section)) : "";
    if (compare_section != "" && compare_section != primary.data.section && primary.data.verdict != "ok") {
        let cmp = run_single_probe(domain, compare_section);
        if (cmp.success) {
            primary.data.comparison = {
                section: cmp.data.section,
                verdict: cmp.data.verdict,
                bypass_verified: cmp.data.verdict == "ok"
            };
        }
        else {
            primary.data.comparison = {
                section: compare_section,
                verdict: cmp.error || "section_probe_unavailable",
                bypass_verified: false
            };
        }
    }

    return primary;
}

function cli(raw_json) {
    let text = raw_json;
    if (text == null || text == "") {
        if (length(ARGV) > 0 && ARGV[0] != "cli")
            text = ARGV[0];
        else if (length(ARGV) > 1 && ARGV[0] == "cli")
            text = ARGV[1];
        else
            text = common.read_stdin();
    }

    let payload = null;
    if (type(text) == "object") {
        payload = text;
    }
    else if (type(text) == "string" && trim(text) != "") {
        try {
            payload = json(text);
        }
        catch (e) {
            payload = null;
        }
    }

    let result = handle(payload);
    common.write_json(result);
    return result;
}

if ((sourcepath(1) != null && sourcepath(1) != "") || SCRIPT_NAME != sourcepath(0)) {
    return {
        valid_domain,
        handle,
        cli
    };
}

cli(length(ARGV) > 0 ? (ARGV[0] == "cli" ? (length(ARGV) > 1 ? ARGV[1] : null) : ARGV[0]) : null);
