#!/usr/bin/env ucode

let fs = require("fs");
let common = require("core.common");
let core_ip = require("core.ip");
let uci_core = require("core.uci");

let as_string = common.as_string;
let option = common.option;
let bool_option = common.bool_option;

const CONFIG_NAME = getenv("FORKOP_CONFIG_NAME") || "forkop";
const TABLE_NAME = "ForkopTorrServerDirect";
const DEFAULT_TORRSERVER_CGROUP = "/services/torrserver";
const DEFAULT_FAKEIP4_RANGE = "198.18.0.0/15";
const DEFAULT_FAKEIP6_RANGE = "2001:2::/112";
const DEFAULT_OUTBOUND_MARK = "0x08000000";

function cgroup_root() {
    let root = trim(as_string(getenv("FORKOP_CGROUP_ROOT") || "/sys/fs/cgroup"));
    while (length(root) > 1 && substr(root, length(root) - 1, 1) == "/")
        root = substr(root, 0, length(root) - 1);
    return root != "" ? root : "/sys/fs/cgroup";
}

function shell_quote(value) {
    return "'" + replace(as_string(value), /'/g, "'\\''") + "'";
}

function command_from_args(args) {
    let parts = [];
    for (let arg in args)
        push(parts, shell_quote(arg));
    return join(" ", parts);
}

function run_quiet(args) {
    return system(command_from_args(args) + " >/dev/null 2>&1") == 0;
}

function log_message(message, level) {
    run_quiet([ "logger", "-t", "forkop", "[" + as_string(level || "info") + "] torrserver: " + as_string(message) ]);
}

function directory_exists(path) {
    let st = fs.stat(as_string(path));
    return st != null && st.type == "directory";
}

function valid_mark(value) {
    value = trim(as_string(value));
    return match(value, /^(0x[0-9A-Fa-f]+|[0-9]+)$/) != null;
}

function valid_ipv4_target(value) {
    value = trim(as_string(value));
    return core_ip.valid_ipv4_cidr(value) || core_ip.valid_ipv4(value);
}

function valid_ipv6_target(value) {
    value = trim(as_string(value));
    return core_ip.valid_ipv6_cidr(value) || core_ip.valid_ipv6(value);
}

function parse_safe_cgroup(raw_value) {
    let value = as_string(raw_value);
    if (value == "" || match(value, /[[:space:]"'\\;`]/) != null)
        return null;
    if (match(value, /^[A-Za-z0-9._\/-]+$/) == null)
        return null;
    if (index(value, "//") >= 0)
        return null;

    while (substr(value, 0, 1) == "/")
        value = substr(value, 1);
    while (length(value) > 0 && substr(value, length(value) - 1, 1) == "/")
        value = substr(value, 0, length(value) - 1);

    if (value == "")
        return null;

    let parts = split(value, "/");
    if (length(parts) < 2)
        return null;

    for (let part in parts) {
        if (part == "" || part == "." || part == "..")
            return null;
    }

    return {
        rel_path: join("/", parts),
        depth: length(parts)
    };
}

function resolve_cgroup(settings) {
    let configured = trim(as_string(option(settings, "torrserver_cgroup", "")));
    let candidate = configured != "" ? configured : DEFAULT_TORRSERVER_CGROUP;
    let parsed = parse_safe_cgroup(candidate);
    if (parsed == null)
        return null;

    let full_path = cgroup_root() + "/" + parsed.rel_path;
    if (!directory_exists(full_path))
        return null;

    return parsed;
}

function cleanup() {
    run_quiet([ "nft", "delete", "table", "inet", TABLE_NAME ]);
    return true;
}

function write_batch_file(content) {
    let base_dir = trim(as_string(getenv("TMPDIR") || "/tmp"));
    if (base_dir == "")
        base_dir = "/tmp";
    let stamp = clock(true);
    let suffix = type(stamp) == "array" ? (as_string(stamp[0]) + "-" + as_string(stamp[1])) : "0";
    let path = base_dir + "/forkop-torrserver-" + suffix + ".nft";
    if (fs.writefile(path, content) == null)
        return null;
    return path;
}

function apply(settings, fakeip_range, fakeip6_range, outbound_mark) {
    settings = type(settings) == "object" ? settings : {};
    cleanup();

    if (!bool_option(settings, "torrserver_direct", false))
        return true;

    fakeip_range = trim(as_string(fakeip_range || DEFAULT_FAKEIP4_RANGE));
    fakeip6_range = trim(as_string(fakeip6_range || DEFAULT_FAKEIP6_RANGE));
    outbound_mark = trim(as_string(outbound_mark || DEFAULT_OUTBOUND_MARK));

    if (!valid_ipv4_target(fakeip_range) || !valid_ipv6_target(fakeip6_range) || !valid_mark(outbound_mark)) {
        log_message("Skipping TorrServer direct bypass due to invalid FakeIP range or outbound mark", "warn");
        return false;
    }

    let cgroup = resolve_cgroup(settings);
    if (cgroup == null) {
        log_message("Skipping TorrServer direct bypass: safe cgroupv2 path is unavailable", "debug");
        return false;
    }

    let ruleset = join("\n", [
        "table inet " + TABLE_NAME + " {",
        "\tchain output {",
        "\t\ttype route hook output priority -151; policy accept;",
        "\t\tip daddr " + fakeip_range + " return",
        "\t\tip6 daddr " + fakeip6_range + " return",
        "\t\tsocket cgroupv2 level " + cgroup.depth + " \"" + cgroup.rel_path + "\" meta mark set " + outbound_mark + " counter",
        "\t}",
        "}",
        ""
    ]);

    let batch_path = write_batch_file(ruleset);
    if (batch_path == null) {
        log_message("Skipping TorrServer direct bypass: failed to stage nft batch", "warn");
        return false;
    }

    let ok = run_quiet([ "nft", "-f", batch_path ]);
    fs.unlink(batch_path);
    if (!ok) {
        cleanup();
        log_message("Skipping TorrServer direct bypass: nft socket cgroupv2 rule unsupported or rejected", "warn");
        return false;
    }

    return true;
}

function apply_from_uci(fakeip_range, fakeip6_range, outbound_mark) {
    let settings = uci_core.get_all(CONFIG_NAME, "settings");
    apply(settings, fakeip_range, fakeip6_range, outbound_mark);
    return true;
}

if (sourcepath(1) != null || length(ARGV) == 0) {
    return {
        TABLE_NAME,
        apply,
        apply_from_uci,
        cleanup,
        resolve_cgroup,
        parse_safe_cgroup
    };
}

let mode = ARGV[0] || "";
if (mode == "apply-from-uci") {
    apply_from_uci(ARGV[1], ARGV[2], ARGV[3]);
    exit(0);
}
else if (mode == "cleanup") {
    cleanup();
    exit(0);
}
else {
    warn("Usage: service/torrserver.uc <apply-from-uci|cleanup> ...\n");
    exit(1);
}
