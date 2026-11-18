#!/usr/bin/env ucode
// SPDX-License-Identifier: GPL-2.0-or-later
// Self-contained Cloudflare WARP / WARP+ registration using sing-box wg-keypair and strict TLS curl.

let fs = require("fs");
let common = require("core.common");
let uci = require("core.uci");
let ip = require("core.ip");
let sha256 = require("core.sha256");
let amnezia = require("singbox.amnezia");
let wg = require("singbox.wireguard");

let as_string = common.as_string;

const DEFAULT_API_URL = "https://api.cloudflareclient.com/v0a2158/reg";
const DEFAULT_WARP_HOST = "engage.cloudflareclient.com";
const DEFAULT_WARP_PORT = 2408;
const DEFAULT_WARP_PEER_PUBKEY = "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=";

function failure(error, detail) {
    let out = { success: false, error };
    if (detail != null && as_string(detail) != "")
        out.detail = as_string(detail);
    return out;
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

function decode_client_id(b64) {
    let bytes = wg.decode_base64_bytes(b64);
    if (bytes == null || length(bytes) != 3)
        return null;
    return [ int(bytes[0]) & 0xff, int(bytes[1]) & 0xff, int(bytes[2]) & 0xff ];
}

function iso8601_utc_now() {
    let t = gmtime();
    if (type(t) != "object" || t == null)
        return "2026-01-01T00:00:00.000Z";
    return sprintf("%04d-%02d-%02dT%02d:%02d:%02d.000Z",
        int(t.year), int(t.mon), int(t.mday),
        int(t.hour), int(t.min), int(t.sec));
}

function generate_wg_keypair() {
    let sb_bin = trim(as_string(getenv("FORKOP_SINGBOX_BINARY") || "/usr/bin/sing-box"));
    if (sb_bin == "")
        return null;

    let pipe = fs.popen(shell_quote(sb_bin) + " generate wg-keypair 2>/dev/null", "r");
    if (!pipe)
        return null;

    let raw = pipe.read("all");
    let status = int(pipe.close());
    if (status > 255)
        status = int(status / 256);

    if (status != 0 || raw == null || trim(raw) == "")
        return null;

    let priv = "";
    let pub = "";
    for (let line in split(replace(raw, /\r/g, ""), "\n")) {
        line = trim(line);
        let colon = index(line, ":");
        if (colon <= 0)
            continue;
        let k = lc(trim(substr(line, 0, colon)));
        let v = trim(substr(line, colon + 1));
        if (k == "privatekey" || k == "private_key" || k == "private key")
            priv = wg.normalize_wg_key(v);
        else if (k == "publickey" || k == "public_key" || k == "public key")
            pub = wg.normalize_wg_key(v);
    }

    if (priv == "" || pub == "")
        return null;

    return { private_key: priv, public_key: pub };
}

function resolve_proxy_section(section) {
    if (section == null)
        return { ok: true, is_proxy: false };

    section = trim(as_string(section));
    if (section == "" || section == "direct")
        return { ok: true, is_proxy: false };

    if (!match(section, /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/))
        return { ok: false, error: "invalid_proxy_section" };

    let cfg_name = getenv("FORKOP_CONFIG_NAME") || "forkop";
    let sec_cfg = uci.get_all(cfg_name, section);
    if (type(sec_cfg) != "object" || sec_cfg == null)
        return { ok: false, error: "proxy_section_unavailable" };

    if (common.option(sec_cfg, "enabled", "1") == "0")
        return { ok: false, error: "proxy_section_unavailable" };

    if (!common.bool_option(sec_cfg, "mixed_proxy_enabled", false))
        return { ok: false, error: "proxy_section_unavailable" };

    let port_str = common.option(sec_cfg, "mixed_proxy_port", "");
    if (!match(port_str, /^[0-9]+$/))
        return { ok: false, error: "proxy_section_unavailable" };

    let port = int(port_str, 10);
    if (port < 1 || port > 65535)
        return { ok: false, error: "proxy_section_unavailable" };

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
        section,
        port,
        auth
    };
}

function url_targets_loopback(url_str) {
    let rest = substr(url_str, 8); // after "https://"
    let slash = index(rest, "/");
    let hostport = slash >= 0 ? substr(rest, 0, slash) : rest;
    if (substr(hostport, 0, 1) == "[") {
        let close = index(hostport, "]");
        let h = close > 1 ? substr(hostport, 1, close - 1) : hostport;
        return h == "::1";
    }
    let colon = index(hostport, ":");
    let h = lc(colon >= 0 ? substr(hostport, 0, colon) : hostport);
    return h == "127.0.0.1" || h == "localhost";
}

function create_private_temp_file(prefix) {
    let base_dir = getenv("TMPDIR") || "/tmp";
    let stamp = clock();
    for (let attempt = 0; attempt < 8; attempt++) {
        let token = substr(sha256.digest(sprintf("%s:%d:%d:%d", prefix, stamp[0], stamp[1], attempt)), 0, 16);
        let path = sprintf("%s/.forkop-%s-%s.tmp", base_dir, prefix, token);
        if (fs.lstat(path) != null)
            continue;
        let fh = fs.open(path, "wex", 0o600);
        if (fh) {
            fh.close();
            fs.chmod(path, 0o600);
            return path;
        }
    }
    return "";
}

function curl_json_request(method, url_str, body_obj, bearer_token, proxy_cfg) {
    let resp_file = create_private_temp_file("warp-resp");
    if (resp_file == "")
        return { ok: false, error: "temp_file_unavailable" };

    let cfg_file = create_private_temp_file("warp-cfg");
    if (cfg_file == "") {
        fs.unlink(resp_file);
        return { ok: false, error: "temp_file_unavailable" };
    }

    let body_file = "";
    if (body_obj != null) {
        body_file = create_private_temp_file("warp-body");
        if (body_file == "") {
            fs.unlink(resp_file);
            fs.unlink(cfg_file);
            return { ok: false, error: "temp_file_unavailable" };
        }
        let bf = fs.open(body_file, "w", 0o600);
        if (!bf) {
            fs.unlink(resp_file);
            fs.unlink(cfg_file);
            fs.unlink(body_file);
            return { ok: false, error: "temp_file_unavailable" };
        }
        bf.write(sprintf("%J", body_obj));
        bf.flush();
        bf.close();
    }

    // Keep Authorization bearer token inside a 0600 curl config file off argv.
    let cfg_lines = [
        "header = \"Content-Type: application/json\"",
        "header = \"Accept: application/json\"",
        "header = \"CF-Client-Version: a-6.30-3596\""
    ];
    if (bearer_token != null && bearer_token != "") {
        let clean_tok = replace(as_string(bearer_token), /["\\\r\n]/g, "");
        push(cfg_lines, "header = \"Authorization: Bearer " + clean_tok + "\"");
    }
    if (proxy_cfg.is_proxy && proxy_cfg.auth != null) {
        let clean_auth = replace(as_string(proxy_cfg.auth), /["\\\r\n]/g, "");
        push(cfg_lines, "proxy-user = \"" + clean_auth + "\"");
    }

    let cf = fs.open(cfg_file, "w", 0o600);
    if (!cf) {
        fs.unlink(resp_file);
        fs.unlink(cfg_file);
        if (body_file != "")
            fs.unlink(body_file);
        return { ok: false, error: "temp_file_unavailable" };
    }
    cf.write(join("\n", cfg_lines) + "\n");
    cf.flush();
    cf.close();

    let curl_bin = getenv("FORKOP_WARP_CURL_BIN") || "curl";
    let args = [
        "-sS",
        "-o", resp_file,
        "--proto", "=https",
        "--proto-redir", "=https",
        "--tlsv1.2",
        "--connect-timeout", "6",
        "--max-time", "15",
        "-X", method,
        "-K", cfg_file,
        "-w", "%{json}"
    ];

    if (body_file != "") {
        push(args, "--data-binary");
        push(args, "@" + body_file);
    }

    let test_ca = trim(as_string(getenv("FORKOP_WARP_TEST_CACERT") || ""));
    if (test_ca != "") {
        push(args, "--cacert");
        push(args, test_ca);
    }

    if (proxy_cfg.is_proxy) {
        push(args, "--socks5-hostname");
        push(args, "127.0.0.1:" + proxy_cfg.port);
    }
    else if (url_targets_loopback(url_str) || getenv("FORKOP_WARP_NOPROXY") == "1") {
        push(args, "--noproxy");
        push(args, "*");
    }

    push(args, url_str);

    let quoted = [ shell_quote(curl_bin) ];
    for (let arg in args)
        push(quoted, shell_quote(arg));

    let pipe = fs.popen(join(" ", quoted) + " 2>/dev/null", "r");
    let meta_raw = pipe ? pipe.read("all") : "";
    let status = pipe ? int(pipe.close()) : -1;
    if (status > 255)
        status = int(status / 256);

    let resp_text = fs.readfile(resp_file);
    fs.unlink(resp_file);
    fs.unlink(cfg_file);
    if (body_file != "")
        fs.unlink(body_file);

    if (!pipe)
        return { ok: false, error: "curl_exec_failed" };

    let meta = {};
    if (meta_raw != null && trim(meta_raw) != "") {
        try {
            let parsed = json(meta_raw);
            if (type(parsed) == "object" && parsed != null)
                meta = parsed;
        }
        catch (e) {}
    }

    let exitcode = meta.exitcode != null ? int(meta.exitcode) : status;
    let errormsg = as_string(meta.errormsg || "");
    let http_code = int(meta.response_code != null ? meta.response_code : (meta.http_code || 0));

    if (proxy_cfg.is_proxy && exitcode == 7 && (int(meta.num_connects || 0) == 0 || index(errormsg, "127.0.0.1") >= 0))
        return { ok: false, error: "proxy_section_unavailable" };

    if (exitcode != 0)
        return { ok: false, error: "warp_api_unreachable", exitcode, detail: errormsg };

    let parsed_body = null;
    if (resp_text != null && trim(resp_text) != "") {
        try {
            parsed_body = json(resp_text);
        }
        catch (e) {
            parsed_body = null;
        }
    }

    // Unwrap Cloudflare v0a API `{ result: { ... }, success: true }` envelope if present
    if (type(parsed_body) == "object" && parsed_body != null && type(parsed_body.result) == "object" && parsed_body.id == null)
        parsed_body = parsed_body.result;

    return {
        ok: http_code >= 200 && http_code < 300,
        http_code,
        body: parsed_body,
        error: http_code >= 200 && http_code < 300 ? null : ("warp_api_http_" + http_code)
    };
}

function split_endpoint_host_port(raw_ep) {
    raw_ep = trim(as_string(raw_ep || ""));
    if (raw_ep == "")
        return null;

    if (substr(raw_ep, 0, 1) == "[") {
        let close = index(raw_ep, "]");
        if (close > 1) {
            let h = substr(raw_ep, 1, close - 1);
            let p_str = substr(raw_ep, close + 1, 1) == ":" ? substr(raw_ep, close + 2) : "";
            let p = match(p_str, /^[0-9]+$/) ? int(p_str, 10) : DEFAULT_WARP_PORT;
            return { host: h, port: p };
        }
    }

    let colon = last_index_of(raw_ep, ":");
    if (colon > 0 && index(raw_ep, ":") == colon) {
        let h = substr(raw_ep, 0, colon);
        let p_str = substr(raw_ep, colon + 1);
        let p = match(p_str, /^[0-9]+$/) ? int(p_str, 10) : DEFAULT_WARP_PORT;
        return { host: h, port: p };
    }

    return { host: raw_ep, port: DEFAULT_WARP_PORT };
}

function handle(payload) {
    if (payload == null)
        payload = {};
    if (type(payload) != "object")
        return failure("invalid_payload");

    let proxy_cfg = resolve_proxy_section(payload.proxy_section);
    if (!proxy_cfg.ok)
        return failure(proxy_cfg.error);

    let api_url = trim(as_string(getenv("FORKOP_WARP_API_URL") || DEFAULT_API_URL));
    while (length(api_url) > 8 && substr(api_url, length(api_url) - 1, 1) == "/")
        api_url = substr(api_url, 0, length(api_url) - 1);

    if (substr(lc(api_url), 0, 8) != "https://")
        return failure("insecure_warp_api_url");

    let awg_obj = null;
    let want_awg = payload.one_sided_awg == true || payload.one_sided_awg == "1" || payload.one_sided_awg == 1;
    if (want_awg || payload.amnezia != null) {
        awg_obj = payload.amnezia != null ? amnezia.normalize(payload.amnezia) : amnezia.default_one_sided_preset();
        let v = amnezia.validate(awg_obj, true);
        if (!v.valid)
            return failure(v.error || "invalid_amnezia_options", v.message);
    }

    let kp = generate_wg_keypair();
    if (kp == null)
        return failure("keypair_generation_failed");

    let stamp = clock();
    let serial = substr(sha256.digest(sprintf("warp:%s:%d:%d", kp.public_key, stamp[0], stamp[1])), 0, 16);
    let reg_req = {
        key: kp.public_key,
        install_id: "",
        fcm_token: "",
        tos: iso8601_utc_now(),
        model: "PC",
        serial_number: serial,
        locale: "en_US"
    };

    let reg_resp = curl_json_request("POST", api_url, reg_req, null, proxy_cfg);
    if (!reg_resp.ok)
        return failure(reg_resp.error || "warp_registration_failed", reg_resp.detail);

    let body = reg_resp.body;
    if (type(body) != "object" || body == null)
        return failure("invalid_warp_response");

    let reg_id = trim(as_string(body.id || ""));
    let auth_token = trim(as_string(body.token || ""));
    let cfg = common.object_or_empty(body.config);
    if (reg_id == "" || auth_token == "")
        return failure("invalid_warp_credentials");

    let license_key = trim(as_string(payload.license_key || ""));
    if (license_key != "") {
        if (length(license_key) > 128 || match(license_key, /[[:space:][:cntrl:]]/))
            return failure("invalid_license_key");

        let lic_resp = curl_json_request("PUT", api_url + "/" + reg_id + "/account", { license: license_key }, auth_token, proxy_cfg);
        if (!lic_resp.ok)
            return failure("warp_license_bind_failed", lic_resp.error);
    }

    let reserved = decode_client_id(cfg.client_id);
    let peers = common.array_or_empty(cfg.peers);
    let first_peer = length(peers) > 0 && type(peers[0]) == "object" ? peers[0] : {};
    let peer_pub = wg.normalize_wg_key(first_peer.public_key || DEFAULT_WARP_PEER_PUBKEY);
    if (peer_pub == "")
        peer_pub = DEFAULT_WARP_PEER_PUBKEY;

    let peer_ep = common.object_or_empty(first_peer.endpoint);
    let chosen_ep = split_endpoint_host_port(payload.endpoint || peer_ep.v4 || peer_ep.host || (DEFAULT_WARP_HOST + ":" + DEFAULT_WARP_PORT));

    let iface = common.object_or_empty(cfg.interface);
    let addrs_obj = common.object_or_empty(iface.addresses);
    let local_addrs = [];
    let v4_addr = trim(as_string(addrs_obj.v4 || ""));
    let v6_addr = trim(as_string(addrs_obj.v6 || ""));
    if (v4_addr != "")
        push(local_addrs, index(v4_addr, "/") >= 0 ? v4_addr : (v4_addr + "/32"));
    if (v6_addr != "")
        push(local_addrs, index(v6_addr, "/") >= 0 ? v6_addr : (v6_addr + "/128"));
    if (length(local_addrs) == 0)
        local_addrs = [ "172.16.0.2/32" ];

    let tag = trim(as_string(payload.tag || ""));
    if (tag == "")
        tag = license_key != "" ? "Cloudflare WARP+" : (awg_obj != null ? "Cloudflare WARP AWG" : "Cloudflare WARP");

    let profile = {
        id: reg_id,
        auth_token,
        private_key: kp.private_key
    };
    if (license_key != "")
        profile.license_key = license_key;

    let endpoint = {
        type: "warp",
        tag,
        address: chosen_ep.host,
        port: chosen_ep.port,
        local_address: local_addrs,
        private_key: kp.private_key,
        peer_public_key: peer_pub,
        mtu: 1280,
        persistent_keepalive_interval: 25,
        profile
    };

    if (reserved != null)
        endpoint.reserved = reserved;
    if (awg_obj != null)
        endpoint.amnezia = awg_obj;

    let link = wg.serialize_share_link(endpoint);

    return {
        success: true,
        data: {
            link,
            endpoint
        }
    };
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

    let payload = {};
    if (type(text) == "object" && text != null) {
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
        decode_client_id,
        register: handle,
        handle,
        cli
    };
}

cli(length(ARGV) > 0 ? (ARGV[0] == "cli" ? (length(ARGV) > 1 ? ARGV[1] : null) : ARGV[0]) : null);
