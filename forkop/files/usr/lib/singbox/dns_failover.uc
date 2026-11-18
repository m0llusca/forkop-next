#!/usr/bin/env ucode

let fs = require("fs");
let uci_core = require("core.uci");
let common = require("core.common");
let core_ip = require("core.ip");
let runtime_dns = require("singbox.dns");

function as_string(value) {
    return value == null ? "" : "" + value;
}

function env_int(name, fallback, min_value) {
    let raw = trim(as_string(getenv(name) ?? ""));
    if (raw == "" || match(raw, /^-?[0-9]+$/) == null)
        return fallback;
    let parsed = int(raw);
    if (min_value != null && parsed < min_value)
        return min_value;
    return parsed;
}

const CONFIG_NAME = getenv("FORKOP_CONFIG_NAME") || "forkop";
const LIB_DIR = getenv("FORKOP_LIB") || "/usr/lib/forkop";
const RUNTIME_STATE_DIR = getenv("FORKOP_RUNTIME_STATE_DIR") || "/var/run/forkop";
const STATE_FILE = getenv("FORKOP_DNS_FAILOVER_STATE_FILE") || RUNTIME_STATE_DIR + "/dns-failover.json";
const PID_FILE = getenv("FORKOP_DNS_FAILOVER_PID_FILE") || RUNTIME_STATE_DIR + "/dns-failover.pid";
const PROC_ROOT = getenv("FORKOP_PROC_ROOT") || "/proc";
const DNS_FAILOVER_UC = getenv("FORKOP_DNS_FAILOVER_UC") || LIB_DIR + "/singbox/dns_failover.uc";
const SERVICE_BIN = getenv("FORKOP_BIN") || "/usr/bin/forkop";
const CHECK_DOMAIN = "example.com";
const FAILURE_THRESHOLD = env_int("FORKOP_DNS_FAILOVER_STRIKES", 3, 1);
const CORE_GRACE_SECONDS = env_int("FORKOP_DNS_FAILOVER_GRACE_SECONDS", 90, 0);

function shell_quote(value) {
    return "'" + replace(as_string(value), /'/g, "'\\''") + "'";
}

function command_from_args(args) {
    let result = [];
    for (let arg in args)
        push(result, shell_quote(arg));
    return join(" ", result);
}

function command_status(command) {
    let status = int(system(command));
    return status > 255 ? int(status / 256) : status;
}

function command_success_from_args(args) {
    return command_status(command_from_args(args) + " >/dev/null 2>&1") == 0;
}

function command_output_from_args(args) {
    let pipe = fs.popen(command_from_args(args) + " 2>/dev/null", "r");
    if (!pipe)
        return "";
    let data = pipe.read("all");
    let status = pipe.close();
    return status == 0 && data != null ? as_string(data) : "";
}

function settings() {
    return common.object_or_empty(uci_core.get_all(CONFIG_NAME, "settings"));
}

function ensure_dir(path) {
    return command_success_from_args([ "mkdir", "-p", path ]);
}

function remove_file(path) {
    try {
        fs.unlink(as_string(path));
    }
    catch (e) {
    }
}

function write_state(path, value) {
    let slash = rindex(as_string(path), "/");
    let dir = slash > 0 ? substr(as_string(path), 0, slash) : RUNTIME_STATE_DIR;
    if (!ensure_dir(dir))
        return false;
    let stamp = clock();
    let temporary = as_string(path) + ".tmp." + as_string(stamp[0]) + "." + as_string(stamp[1]);
    if (!common.write_json_file(temporary, value))
        return false;
    if (!fs.rename(temporary, path)) {
        remove_file(temporary);
        return false;
    }
    return true;
}

function log_message(message, level) {
    command_success_from_args([ "logger", "-t", "forkop", "[" + as_string(level || "info") + "] DNS failover: " + as_string(message) ]);
}

function duration_milliseconds(value, fallback) {
    let rest = as_string(value);
    let total = 0.0;
    let units = { ns: 0.000001, us: 0.001, ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
    while (rest != "") {
        let matched = match(rest, /^([0-9]+(\.[0-9]+)?)(ns|us|ms|s|m|h|d)/);
        if (!matched)
            return fallback;
        total += (matched[1] * 1) * units[matched[3]];
        rest = substr(rest, length(matched[0]));
    }
    return total > 0 ? int(total + 0.5) : fallback;
}

function duration_seconds(value, fallback) {
    let milliseconds = duration_milliseconds(value, fallback * 1000);
    return int((milliseconds + 999) / 1000);
}

function probe_timeout(settings_value) {
    return duration_seconds(settings_value, 2);
}

function normalize_kind(kind) {
    return as_string(kind) == "main" ? "main" : "bootstrap";
}

function probe_port(kind, index_value, timeout_seconds) {
    let normalized_kind = normalize_kind(kind);
    let args = [
        "dig", "-p", as_string(runtime_dns.health_port(normalized_kind, index_value)),
        "@" + runtime_dns.DNS_HEALTH_ADDRESS,
        CHECK_DOMAIN, "A", "+short",
        "+timeout=" + as_string(timeout_seconds), "+tries=1"
    ];
    for (let line in split(command_output_from_args(args), "\n"))
        if (core_ip.valid_ipv4(trim(as_string(line))))
            return true;
    return false;
}

function probe_canonical_main(timeout_seconds) {
    let args = [
        "dig", "-p", as_string(runtime_dns.health_port("active", 0)),
        "@" + runtime_dns.DNS_HEALTH_ADDRESS, CHECK_DOMAIN, "A", "+short",
        "+timeout=" + as_string(timeout_seconds), "+tries=1"
    ];
    for (let line in split(command_output_from_args(args), "\n"))
        if (core_ip.valid_ipv4(trim(as_string(line))))
            return true;
    return false;
}

function verification_plan(previous, candidate) {
    previous = common.object_or_empty(previous);
    candidate = common.object_or_empty(candidate);
    return {
        main: int(candidate.main_index || 0) != int(previous.main_index || 0),
        bootstrap: int(candidate.bootstrap_index || 0) != int(previous.bootstrap_index || 0) &&
            length(candidate.bootstrap_servers || []) > 1
    };
}

function verify_state(path) {
    let cfg = settings();
    let state = common.read_json_file(path);
    let expected = runtime_dns.state_template(cfg);
    if (!runtime_dns.state_matches(expected, state))
        return false;

    state = runtime_dns.normalize_state(cfg, state);
    let previous = runtime_dns.normalize_state(cfg, common.read_json_file(STATE_FILE));
    let plan = verification_plan(previous, state);
    let timeout_seconds = probe_timeout(common.option(cfg, "dns_check_timeout", "2s"));
    if (plan.main && !probe_canonical_main(timeout_seconds))
        return false;
    if (plan.bootstrap && !probe_port("bootstrap", state.bootstrap_index, timeout_seconds))
        return false;
    return true;
}

function commit_state(path) {
    let cfg = settings();
    let state = common.read_json_file(path);
    if (!runtime_dns.state_matches(runtime_dns.state_template(cfg), state))
        return false;
    return fs.rename(path, STATE_FILE);
}

function monotonic_seconds() {
    let mono = clock(true);
    if (type(mono) == "array" && length(mono) > 0)
        return int(mono[0]);
    return int(require("core.scheduler").now());
}

function now_seconds() {
    return monotonic_seconds();
}

function process_start_ticks_from_stat(stat_line) {
    stat_line = trim(as_string(stat_line));
    if (stat_line == "")
        return null;
    let close_paren = rindex(stat_line, ") ");
    if (close_paren < 0)
        return null;
    let rest = substr(stat_line, close_paren + 2);
    let fields = split(trim(replace(rest, /[[:space:]]+/g, " ")), " ");
    if (length(fields) <= 19)
        return null;
    let ticks = trim(as_string(fields[19]));
    return match(ticks, /^[0-9]+$/) != null ? ticks : null;
}

function read_pid_start_ticks(pid) {
    pid = trim(as_string(pid));
    if (match(pid, /^[0-9]+$/) == null)
        return null;
    let data = fs.readfile(PROC_ROOT + "/" + pid + "/stat");
    if (data == null)
        return null;
    return process_start_ticks_from_stat(data);
}

function sing_box_service_status() {
    let raw = command_output_from_args([ "ubus", "call", "service", "list", "{\"name\":\"sing-box\"}" ]);
    if (trim(raw) == "")
        return { known: false, running: true, pid: "" };
    let parsed;
    try { parsed = json(raw); }
    catch (e) { return { known: false, running: true, pid: "" }; }
    let svc = common.object_or_empty(common.object_or_empty(parsed)["sing-box"]);
    let instances = common.object_or_empty(svc.instances);
    for (let name in keys(instances)) {
        let inst = common.object_or_empty(instances[name]);
        if (inst.running === true && int(inst.pid || 0) > 0)
            return { known: true, running: true, pid: as_string(int(inst.pid)) };
    }
    return { known: true, running: false, pid: "" };
}

function check_core_grace(loop_state, mono_now) {
    let svc = sing_box_service_status();
    if (svc.known && !svc.running) {
        loop_state.core = null;
        loop_state.strikes = { main: 0, bootstrap: 0 };
        return { ready: false, reason: "core_not_running" };
    }
    if (svc.pid != "") {
        let ticks = read_pid_start_ticks(svc.pid);
        if (ticks != null) {
            let prev = common.object_or_empty(loop_state.core);
            if (as_string(prev.pid) != svc.pid || as_string(prev.start_ticks) != ticks || prev.seen_mono == null) {
                loop_state.core = {
                    pid: svc.pid,
                    start_ticks: ticks,
                    seen_mono: int(mono_now)
                };
                loop_state.strikes = { main: 0, bootstrap: 0 };
            }
            if (CORE_GRACE_SECONDS > 0 && (int(mono_now) - int(loop_state.core.seen_mono)) < CORE_GRACE_SECONDS)
                return { ready: false, reason: "startup_grace" };
        }
    }
    return { ready: true, reason: "ready" };
}

function choose_index(kind, state, current_index, timeout_seconds, recovery, strikes, threshold) {
    let kind_key = normalize_kind(kind);
    strikes = type(strikes) == "object" ? strikes : { main: 0, bootstrap: 0 };
    let max_strikes = threshold != null ? int(threshold) : FAILURE_THRESHOLD;
    let values = kind_key == "main" ? state.main_servers : state.bootstrap_servers;
    if (length(values) <= 1) {
        strikes[kind_key] = 0;
        return { index: 0, reason: "single", alive: true, strikes: 0 };
    }

    if (recovery) {
        if (current_index <= 0)
            return { index: 0, reason: "unchanged", alive: true, strikes: int(strikes[kind_key] || 0) };
        for (let i = 0; i < current_index; i++) {
            if (probe_port(kind_key, i, timeout_seconds)) {
                strikes[kind_key] = 0;
                return { index: i, reason: "recovery", alive: true, strikes: 0 };
            }
        }
        return { index: current_index, reason: "unchanged", alive: true, strikes: int(strikes[kind_key] || 0) };
    }

    if (probe_port(kind_key, current_index, timeout_seconds)) {
        strikes[kind_key] = 0;
        return { index: current_index, reason: "alive", alive: true, strikes: 0 };
    }

    strikes[kind_key] = int(strikes[kind_key] || 0) + 1;
    if (strikes[kind_key] < max_strikes)
        return { index: current_index, reason: "debounce", alive: true, strikes: strikes[kind_key] };

    for (let i = 0; i < length(values); i++) {
        if (i == current_index)
            continue;
        if (probe_port(kind_key, i, timeout_seconds))
            return { index: i, reason: i < current_index ? "recovery" : "active_dead", alive: true, strikes: strikes[kind_key] };
    }
    return { index: current_index, reason: "all_down", alive: false, strikes: strikes[kind_key] };
}

function clone_state(value) {
    return json(sprintf("%J", value));
}

function apply_selections(state, selections, strikes) {
    let candidate = clone_state(state);
    let changed = [];
    for (let kind in [ "bootstrap", "main" ]) {
        let selected = common.object_or_empty(common.object_or_empty(selections)[kind]);
        if (selected.index == null)
            continue;
        let key = kind == "main" ? "main_index" : "bootstrap_index";
        if (int(candidate[key]) == int(selected.index))
            continue;
        candidate[key] = int(selected.index);
        push(changed, { kind, selected });
    }
    if (length(changed) == 0)
        return true;

    let stamp = clock();
    let candidate_path = STATE_FILE + ".candidate." + as_string(stamp[0]) + "." + as_string(stamp[1]);
    if (!write_state(candidate_path, candidate))
        return false;

    let status = command_status(command_from_args([ SERVICE_BIN, "dns_failover_apply", candidate_path ]) + " >/dev/null 2>&1");
    remove_file(candidate_path);
    if (status != 0)
        return false;

    state.main_index = candidate.main_index;
    state.bootstrap_index = candidate.bootstrap_index;
    for (let item in changed) {
        if (type(strikes) == "object")
            strikes[item.kind] = 0;
        let values = item.kind == "main" ? state.main_servers : state.bootstrap_servers;
        let selected = item.selected;
        log_message("switched " + item.kind + " DNS to priority " + as_string(selected.index + 1) + " (" + values[selected.index] + ", " + selected.reason + ")", "info");
    }
    return true;
}

function init_loop_state(existing, cfg, now) {
    let loop_state = common.object_or_empty(existing);
    let active_interval = duration_seconds(common.option(cfg, "dns_check_interval", "10s"), 10);
    let recovery_interval = duration_seconds(common.option(cfg, "dns_recovery_check_interval", "60s"), 60);
    if (type(loop_state.strikes) != "object")
        loop_state.strikes = { main: 0, bootstrap: 0 };
    if (type(loop_state.all_down) != "object")
        loop_state.all_down = { main: false, bootstrap: false };
    if (loop_state.next_active == null)
        loop_state.next_active = int(now);
    if (loop_state.next_recovery == null)
        loop_state.next_recovery = int(now) + recovery_interval;
    loop_state.active_interval = active_interval;
    loop_state.recovery_interval = recovery_interval;
    return loop_state;
}

function step_runtime(state, loop_state, current_cfg, now) {
    let active_interval = duration_seconds(common.option(current_cfg, "dns_check_interval", "10s"), 10);
    let recovery_interval = duration_seconds(common.option(current_cfg, "dns_recovery_check_interval", "60s"), 60);
    let timeout_seconds = probe_timeout(common.option(current_cfg, "dns_check_timeout", "2s"));

    let grace = check_core_grace(loop_state, now);
    if (!grace.ready)
        return { skipped: true, reason: grace.reason };

    if (now >= int(loop_state.next_active)) {
        let bootstrap = choose_index("bootstrap", state, int(state.bootstrap_index), timeout_seconds, false, loop_state.strikes, FAILURE_THRESHOLD);
        if (!bootstrap.alive && !loop_state.all_down.bootstrap)
            log_message("all configured bootstrap DNS servers are unavailable", "warn");
        loop_state.all_down.bootstrap = !bootstrap.alive;

        if (bootstrap.index != int(state.bootstrap_index)) {
            let main = choose_index("main", state, int(state.main_index), timeout_seconds, false, loop_state.strikes, FAILURE_THRESHOLD);
            let selections = { bootstrap };
            if (main.alive)
                selections.main = main;
            let applied = apply_selections(state, selections, loop_state.strikes);
            loop_state.next_active = int(now) + (applied && !main.alive ? 1 : active_interval);
        }
        else {
            let main = choose_index("main", state, int(state.main_index), timeout_seconds, false, loop_state.strikes, FAILURE_THRESHOLD);
            if (!main.alive && !loop_state.all_down.main)
                log_message("all configured main DNS servers are unavailable", "warn");
            loop_state.all_down.main = !main.alive;
            apply_selections(state, { main }, loop_state.strikes);
            loop_state.next_active = int(now) + active_interval;
        }
    }

    if (now >= int(loop_state.next_recovery)) {
        let bootstrap = choose_index("bootstrap", state, int(state.bootstrap_index), timeout_seconds, true, loop_state.strikes, FAILURE_THRESHOLD);
        let main = choose_index("main", state, int(state.main_index), timeout_seconds, true, loop_state.strikes, FAILURE_THRESHOLD);
        let has_changes = bootstrap.index != int(state.bootstrap_index) || main.index != int(state.main_index);
        let applied = apply_selections(state, { bootstrap, main }, loop_state.strikes);
        if (has_changes && applied)
            loop_state.next_active = int(now) + active_interval;
        loop_state.next_recovery = int(now) + recovery_interval;
    }

    return { skipped: false, reason: "checked" };
}

function run_loop() {
    let cfg = settings();
    let state = runtime_dns.normalize_state(cfg, common.read_json_file(STATE_FILE));
    if (length(state.main_servers) <= 1 && length(state.bootstrap_servers) <= 1)
        return 0;
    if (!write_state(STATE_FILE, state))
        return 1;

    let loop_state = init_loop_state({}, cfg, now_seconds());

    while (true) {
        let now = now_seconds();
        let current_cfg = settings();
        if (!runtime_dns.state_matches(runtime_dns.state_template(current_cfg), state))
            return 0;

        step_runtime(state, loop_state, current_cfg, now);
        command_success_from_args([ "sleep", "1" ]);
    }
}

function worker() {
    return run_loop();
}

function read_pid_record(path) {
    let data = fs.readfile(path);
    if (data == null)
        return { pid: "", start_ticks: null };
    let lines = split(replace(as_string(data), /\r/g, ""), "\n");
    let first_tokens = split(trim(as_string(lines[0] || "")), " ");
    let pid = trim(as_string(first_tokens[0] || ""));
    let ticks = null;
    if (length(first_tokens) > 1 && match(trim(as_string(first_tokens[1])), /^[0-9]+$/) != null)
        ticks = trim(as_string(first_tokens[1]));
    else if (length(lines) > 1 && match(trim(as_string(lines[1])), /^[0-9]+$/) != null)
        ticks = trim(as_string(lines[1]));
    return { pid, start_ticks: ticks };
}

function file_first_line(path) {
    return read_pid_record(path).pid;
}

function process_running(pid) {
    return match(as_string(pid), /^[0-9]+$/) != null && command_success_from_args([ "kill", "-0", pid ]);
}

function pid_matches_recorded_ticks(record) {
    if (record.start_ticks == null)
        return true;
    let current_ticks = read_pid_start_ticks(record.pid);
    if (current_ticks == null)
        return true;
    return current_ticks == record.start_ticks;
}

function stop_runtime() {
    let record = read_pid_record(PID_FILE);
    if (process_running(record.pid) && pid_matches_recorded_ticks(record))
        command_success_from_args([ "kill", record.pid ]);
    remove_file(PID_FILE);
    return 0;
}

function start_runtime() {
    let cfg = settings();
    stop_runtime();
    if (!runtime_dns.failover_enabled(cfg)) {
        remove_file(STATE_FILE);
        return 0;
    }
    if (!ensure_dir(RUNTIME_STATE_DIR))
        return 1;

    let command = command_from_args([ "ucode", "-L", LIB_DIR, DNS_FAILOVER_UC, "worker" ]) +
        " >/dev/null 2>&1 1000>&- & echo $! >" + shell_quote(PID_FILE);
    let status = command_status(command);
    if (status == 0) {
        let pid = file_first_line(PID_FILE);
        let ticks = read_pid_start_ticks(pid);
        if (pid != "" && ticks != null)
            fs.writefile(PID_FILE, pid + "\n" + ticks + "\n");
    }
    return status;
}

function select_fixture(state_path, alive_path, kind, recovery, strikes_path) {
    let state = common.object_or_empty(common.read_json_file(state_path));
    let alive = common.object_or_empty(common.read_json_file(alive_path));
    let kind_key = normalize_kind(kind);
    let key = kind_key == "main" ? "main_index" : "bootstrap_index";
    let values = kind_key == "main" ? state.main_servers : state.bootstrap_servers;
    let current = int(state[key] || 0);
    let probe = function(index_value) { return alive[as_string(index_value)] === true || alive[as_string(index_value)] == 1; };
    let use_strikes = as_string(strikes_path) != "";
    let strikes = use_strikes ? common.object_or_empty(common.read_json_file(strikes_path)) : { main: 0, bootstrap: 0 };
    let threshold = use_strikes ? FAILURE_THRESHOLD : 1;
    let selected = { index: current, reason: "all_down", alive: false };

    if (as_string(recovery) == "1") {
        selected = { index: current, reason: "unchanged", alive: true };
        for (let i = 0; i < current; i++)
            if (probe(i)) {
                strikes[kind_key] = 0;
                selected = { index: i, reason: "recovery", alive: true };
                break;
            }
    }
    else if (probe(current)) {
        strikes[kind_key] = 0;
        selected = { index: current, reason: "alive", alive: true };
    }
    else {
        strikes[kind_key] = int(strikes[kind_key] || 0) + 1;
        if (strikes[kind_key] < threshold) {
            selected = { index: current, reason: "debounce", alive: true, strikes: strikes[kind_key] };
        }
        else {
            for (let i = 0; i < length(values); i++)
                if (i != current && probe(i)) {
                    strikes[kind_key] = 0;
                    selected = { index: i, reason: i < current ? "recovery" : "active_dead", alive: true };
                    break;
                }
        }
    }
    if (use_strikes)
        write_state(strikes_path, strikes);
    common.write_json(selected);
}

function step_fixture(loop_state_path, mono_now_arg) {
    let cfg = settings();
    let state = runtime_dns.normalize_state(cfg, common.read_json_file(STATE_FILE));
    if (!fs.stat(STATE_FILE))
        write_state(STATE_FILE, state);
    let now = as_string(mono_now_arg) != "" ? int(mono_now_arg) : now_seconds();
    let loop_state = init_loop_state(common.read_json_file(loop_state_path), cfg, now);
    let outcome = step_runtime(state, loop_state, cfg, now);
    write_state(loop_state_path, loop_state);
    common.write_json({
        outcome,
        state: runtime_dns.normalize_state(cfg, common.read_json_file(STATE_FILE)),
        strikes: loop_state.strikes
    });
    return 0;
}

let mode = ARGV[0] || "";

if (mode == "start-runtime")
    exit(start_runtime());
else if (mode == "stop-runtime")
    exit(stop_runtime());
else if (mode == "worker" || mode == "run-loop")
    exit(worker());
else if (mode == "verify-state")
    exit(verify_state(ARGV[1]) ? 0 : 1);
else if (mode == "commit-state")
    exit(commit_state(ARGV[1]) ? 0 : 1);
else if (mode == "select-fixture")
    select_fixture(ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5]);
else if (mode == "step-fixture")
    exit(step_fixture(ARGV[1], ARGV[2]));
else if (mode == "verification-plan-fixture")
    common.write_json(verification_plan(common.read_json_file(ARGV[1]), common.read_json_file(ARGV[2])));
else {
    warn("Usage: singbox/dns_failover.uc <start-runtime|stop-runtime|worker|verify-state|commit-state|select-fixture|step-fixture|verification-plan-fixture> ...\n");
    exit(1);
}
