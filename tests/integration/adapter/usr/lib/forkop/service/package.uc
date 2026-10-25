#!/usr/bin/env ucode

let fs = require("fs");
let uci_core = require("core.uci");

function as_string(value) {
    return value == null ? "" : "" + value;
}

function env(name, fallback) {
    let value = getenv(name);
    return value == null ? as_string(fallback) : as_string(value);
}

const CONFIG_NAME = env("FORKOP_CONFIG_NAME", "forkop");
const RT_TABLES_PATH = env("FORKOP_RT_TABLES", "/etc/iproute2/rt_tables");
const BIN_PATH = env("FORKOP_BIN", "/usr/bin/forkop");
const INIT_PATH = env("FORKOP_INIT", "/etc/init.d/forkop");
const DNS_APPLY_UC = env("FORKOP_DNS_APPLY_UC", "/usr/lib/forkop/dns/apply.uc");
const SING_BOX_INIT = env("FORKOP_SING_BOX_INIT", "/etc/init.d/sing-box");
const SING_BOX_BIN = env("FORKOP_SING_BOX_BIN", "/usr/bin/sing-box");
const SING_BOX_CRONET = env("FORKOP_SING_BOX_CRONET", "/usr/lib/libcronet.so");
const SING_BOX_MANAGED_MARKER = env("SB_MANAGED_SERVICE_MARKER", "Forkop managed sing-box service for binary variants");
const PACKAGE_UPGRADE_STATE = env("FORKOP_PACKAGE_UPGRADE_STATE", "/tmp/forkop-package-was-running");
const PACKAGE_TEST_MODE = env("FORKOP_PACKAGE_TEST_MODE", "") != "";

function shell_quote(value) {
    return "'" + replace(as_string(value), /'/g, "'\\''") + "'";
}

function command_from_args(args) {
    let parts = [];
    for (let arg in args)
        push(parts, shell_quote(arg));
    return join(" ", parts);
}

function normalize_status(status) {
    status = int(status);
    return status > 255 ? int(status / 256) : status;
}

function command_success_from_args(args) {
    return normalize_status(system(command_from_args(args) + " >/dev/null 2>&1")) == 0;
}

function path_exists(path) {
    return fs.stat(as_string(path)) != null;
}

function unlink_if_exists(path) {
    if (path_exists(path))
        fs.unlink(as_string(path));
}

function remove_rt_tables_entry() {
    let data = fs.readfile(RT_TABLES_PATH);
    if (data == null)
        return true;

    let changed = false;
    let lines = [];
    for (let line in split(data, "\n")) {
        if (index(line, "105 forkop") >= 0) {
            changed = true;
            continue;
        }
        push(lines, line);
    }

    return !changed || fs.writefile(RT_TABLES_PATH, join("\n", lines)) != null;
}

function ascii_lower(value) {
    let upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let lower = "abcdefghijklmnopqrstuvwxyz";
    return replace(as_string(value), /[A-Z]/g, function(ch) {
        return substr(lower, index(upper, ch), 1);
    });
}

function truthy(value) {
    value = ascii_lower(trim(as_string(value)));
    return value == "1" || value == "true" || value == "yes" || value == "on";
}

function dont_touch_dhcp_enabled() {
    return truthy(uci_core.get(CONFIG_NAME + ".settings.dont_touch_dhcp"));
}

function restore_dnsmasq_if_needed() {
    if (dont_touch_dhcp_enabled())
        return;

    command_success_from_args([ BIN_PATH, "restore_dnsmasq" ]);
    if (path_exists(DNS_APPLY_UC))
        command_success_from_args([ "ucode", DNS_APPLY_UC, "failsafe-restore" ]);
}

function remove_managed_sing_box() {
    let data = fs.readfile(SING_BOX_INIT);
    if (data == null || index(data, SING_BOX_MANAGED_MARKER) < 0)
        return;

    command_success_from_args([ SING_BOX_INIT, "stop" ]);
    command_success_from_args([ SING_BOX_INIT, "disable" ]);
    unlink_if_exists(SING_BOX_INIT);
    unlink_if_exists(SING_BOX_BIN);
    unlink_if_exists(SING_BOX_CRONET);
}

function write_upgrade_state(value) {
    let data = sprintf("%J\n", value);
    if (length(data) >= 65536)
        return false;
    let stamp = clock();
    let temporary = PACKAGE_UPGRADE_STATE + "." + stamp[0] + "." + stamp[1];
    let file = fs.open(temporary, "wex", 384); // 0600; ucode modes are numeric.
    if (!file)
        return false;
    let good = fs.chmod(temporary, 384);
    let info = fs.lstat(temporary);
    good = good && info && (info.mode & 511) == 384;
    good = good && file.write(data) == length(data);
    file.flush();
    file.close();
    good = good && fs.rename(temporary, PACKAGE_UPGRADE_STATE);
    if (!good)
        fs.unlink(temporary);
    return !!good;
}

function capture_upgrade_selectors() {
    let pipe = fs.popen(command_from_args([ BIN_PATH, "maintenance_snapshot" ]) + " 2>/dev/null", "r");
    if (!pipe)
        return null;
    let data = pipe.read("all");
    let status = normalize_status(pipe.close());
    if (status != 0)
        return null;
    try {
        let snapshot = json(data);
        return type(snapshot) == "object" && type(snapshot.selections) == "object" ? snapshot : null;
    }
    catch (e) {
        return null;
    }
}

function remember_upgrade_state(action) {
    if (as_string(action) != "upgrade" || !command_success_from_args([ INIT_PATH, "status" ])) {
        unlink_if_exists(PACKAGE_UPGRADE_STATE);
        return { ok: true, running: false };
    }

    let snapshot = capture_upgrade_selectors();
    if (snapshot == null)
        return { ok: false, running: true };
    return {
        ok: write_upgrade_state({ version: 1, selector_state: snapshot }),
        running: true
    };
}

function prerm_cleanup(action) {
    if (env("IPKG_INSTROOT", "") != "")
        return true;

    let state = remember_upgrade_state(action);
    if (!state.ok)
        return false;
    if (!PACKAGE_TEST_MODE) {
        if (state.running) {
            if (!command_success_from_args([ INIT_PATH, "maintenance_stop" ])) {
                restore_dnsmasq_if_needed();
                unlink_if_exists(PACKAGE_UPGRADE_STATE);
                return false;
            }
        }
        else {
            command_success_from_args([ INIT_PATH, "stop" ]);
            restore_dnsmasq_if_needed();
        }
        // The core is installed independently of the Forkop package payload.
        // Keep it available for postinst to resume the service after an upgrade.
        if (as_string(action) != "upgrade")
            remove_managed_sing_box();
    }
    let success = remove_rt_tables_entry();
    if (!success && state.running && !PACKAGE_TEST_MODE) {
        restore_dnsmasq_if_needed();
        unlink_if_exists(PACKAGE_UPGRADE_STATE);
    }
    return success;
}

function postinst_restore() {
    if (env("IPKG_INSTROOT", "") != "" || !path_exists(PACKAGE_UPGRADE_STATE))
        return true;

    let state = null;
    let info = fs.lstat(PACKAGE_UPGRADE_STATE);
    let owner = fs.stat("/proc/self");
    if (info && owner && info.uid == owner.uid && info.type == "file" && info.size < 65536) {
        try { state = json(fs.readfile(PACKAGE_UPGRADE_STATE)); }
        catch (e) { state = null; }
    }
    // Legacy plain markers select ordinary recovery. Only a private handoff
    // owned by this executor (root for the installed service) permits maintenance.
    let maintenance = info && (info.mode & 511) == 384 && type(state) == "object" &&
        state.version == 1 && type(state.selector_state) == "object";
    if ((!maintenance && state !== 1) ||
        !command_success_from_args([ INIT_PATH, maintenance ? "maintenance_start" : "start" ])) {
        restore_dnsmasq_if_needed();
        return false;
    }

    unlink_if_exists(PACKAGE_UPGRADE_STATE);
    return true;
}

function luci_cache_globs() {
    let configured = env("FORKOP_LUCI_CACHE_GLOBS", "");
    if (configured != "")
        return split(configured, /[ \t\r\n]+/);

    return [ "/var/luci-indexcache*", "/tmp/luci-indexcache*" ];
}

function remove_luci_index_cache() {
    for (let pattern in luci_cache_globs()) {
        pattern = as_string(pattern);
        if (pattern == "")
            continue;

        for (let path in fs.glob(pattern))
            unlink_if_exists(path);
    }
}

function luci_postinst() {
    remove_luci_index_cache();
    if (!PACKAGE_TEST_MODE) {
        if (path_exists("/etc/init.d/rpcd"))
            command_success_from_args([ "/etc/init.d/rpcd", "reload" ]);
        command_success_from_args([ "logger", "-t", "forkop", "[info] Package defaults applied" ]);
    }
    return true;
}

let mode = ARGV[0] || "";

if (mode == "prerm")
    exit(prerm_cleanup(ARGV[1]) ? 0 : 1);
else if (mode == "postinst")
    exit(postinst_restore() ? 0 : 1);
else if (mode == "remove-rt-tables-entry")
    exit(remove_rt_tables_entry() ? 0 : 1);
else if (mode == "luci-postinst")
    exit(luci_postinst() ? 0 : 1);
else {
    warn("Usage: service/package.uc <prerm|postinst|remove-rt-tables-entry|luci-postinst>\n");
    exit(1);
}
