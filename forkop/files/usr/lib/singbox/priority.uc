#!/usr/bin/env ucode

let fs = require("fs");
let common = require("core.common");
let uci_core = require("core.uci");
let runtime_constants = require("singbox.constants");

let as_string = common.as_string;
let read_json_file = common.read_json_file;
let write_json = common.write_json;
let array_or_empty = common.array_or_empty;
let object_or_empty = common.object_or_empty;

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
const SECTION_CACHE_DIR = getenv("FORKOP_SECTION_CACHE_DIR") || RUNTIME_STATE_DIR + "/section-cache";
const PRIORITY_PID_FILE = getenv("FORKOP_PRIORITY_PID_FILE") || RUNTIME_STATE_DIR + "/priority.pid";
const PIN_GUARD_STATE_FILE = getenv("FORKOP_PIN_GUARD_STATE_FILE") || RUNTIME_STATE_DIR + "/pin-guard.json";
const PROC_ROOT = getenv("FORKOP_PROC_ROOT") || "/proc";
const PRIORITY_UC = getenv("FORKOP_PRIORITY_UC") || LIB_DIR + "/singbox/priority.uc";
const DIAGNOSTICS_UC = getenv("FORKOP_DIAGNOSTICS_UC") || LIB_DIR + "/diagnostics/runtime.uc";
const PIN_GUARD_STRIKES = env_int("FORKOP_PIN_GUARD_STRIKES", 3, 1);
const PIN_GUARD_TIMEOUT_MS = env_int("FORKOP_PIN_GUARD_TIMEOUT_MS", 5000, 100);
const PIN_GUARD_INTERVAL = env_int("FORKOP_PIN_GUARD_INTERVAL", 10, 1);
const PIN_GUARD_MAX_EVENTS = 16;

function shell_quote(value) {
    return "'" + replace(as_string(value), /'/g, "'\\''") + "'";
}

function command_from_args(args) {
    let parts = [];
    for (let arg in args)
        push(parts, shell_quote(arg));
    return join(" ", parts);
}

function command_output(command) {
    let pipe = fs.popen(command, "r");
    if (!pipe)
        return "";

    let data = pipe.read("all");
    let status = pipe.close();
    if (status != 0 || data == null)
        return "";
    return as_string(data);
}

function command_output_from_args(args) {
    return command_output(command_from_args(args));
}

function command_status(command) {
    let status = int(system(command));
    return status > 255 ? int(status / 256) : status;
}

function command_success_from_args(args) {
    return command_status(command_from_args(args) + " >/dev/null 2>&1") == 0;
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

function atomic_write_json(path, value) {
    let slash = rindex(as_string(path), "/");
    let dir = slash > 0 ? substr(as_string(path), 0, slash) : RUNTIME_STATE_DIR;
    if (!ensure_dir(dir))
        return false;
    let stamp = clock(true);
    let suffix = type(stamp) == "array" ? (as_string(stamp[0]) + "." + as_string(stamp[1])) : "0";
    let temporary = as_string(path) + ".tmp." + suffix;
    if (!common.write_json_file(temporary, value))
        return false;
    if (!fs.rename(temporary, path)) {
        remove_file(temporary);
        return false;
    }
    return true;
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

function read_pid_record(path) {
    let data = fs.readfile(as_string(path));
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

function pid_matches_recorded_ticks(record) {
    if (record.start_ticks == null)
        return true;
    let current_ticks = read_pid_start_ticks(record.pid);
    if (current_ticks == null)
        return true;
    return current_ticks == record.start_ticks;
}

function log_message(message, level) {
    level = as_string(level || "info");
    command_success_from_args([ "logger", "-t", "forkop", "[" + level + "] priority: " + as_string(message) ]);
}

function now_seconds() {
    return int(require("core.scheduler").now());
}

function duration_to_milliseconds(value, fallback_ms) {
    let rest = as_string(value);
    if (rest == "")
        return fallback_ms;

    let total = 0.0;
    let multipliers = {
        ns: 0.000001,
        us: 0.001,
        ms: 1,
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000
    };

    while (rest != "") {
        let matched = match(rest, /^([0-9]+(\.[0-9]+)?)(ns|us|ms|s|m|h|d)/);
        if (!matched)
            return fallback_ms;

        let token = as_string(matched[0]);
        total += (matched[1] * 1) * multipliers[matched[3]];
        rest = substr(rest, length(token));
    }

    return total <= 0 ? fallback_ms : int(total + 0.5);
}

function duration_to_seconds(value, fallback_seconds) {
    let ms = duration_to_milliseconds(value, fallback_seconds * 1000);
    let seconds = int((ms + 999) / 1000);
    return seconds > 0 ? seconds : fallback_seconds;
}

function bool_value(value, fallback) {
    if (value == null || value == "")
        return !!fallback;
    value = lc(as_string(value));
    return value == "1" || value == "true" || value == "yes" || value == "on";
}

function unique_strings(values) {
    let seen = {};
    let result = [];
    for (let item in array_or_empty(values)) {
        item = trim(as_string(item));
        if (item != "" && !seen[item]) {
            seen[item] = true;
            push(result, item);
        }
    }
    return result;
}

function contains_string(values, target) {
    target = as_string(target);
    for (let item in array_or_empty(values))
        if (as_string(item) == target)
            return true;
    return false;
}

function cache_basename_section(path) {
    path = as_string(path);
    let slash = rindex(path, "/");
    let base = slash >= 0 ? substr(path, slash + 1) : path;
    if (length(base) > 5 && substr(base, length(base) - 5) == ".json")
        return substr(base, 0, length(base) - 5);
    return "";
}

function normalize_group(group, tag_name) {
    group = object_or_empty(group);
    let levels = [];
    for (let level in array_or_empty(group.levels)) {
        let outbounds = [];
        for (let outbound in array_or_empty(level.outbounds)) {
            outbound = as_string(outbound);
            if (outbound != "")
                push(outbounds, outbound);
        }
        if (length(outbounds) > 0) {
            push(levels, {
                id: as_string(level.id || ""),
                displayName: as_string(level.displayName || level.name || ""),
                order: int(level.order || 0),
                outbounds
            });
        }
    }

    return {
        id: as_string(group.id || ""),
        tag: as_string(group.tag || tag_name),
        section: as_string(group.section || ""),
        displayName: as_string(group.displayName || group.name || tag_name),
        health_url: as_string(group.health_url || "https://www.gstatic.com/generate_204"),
        active_check_interval: as_string(group.active_check_interval || "5s"),
        check_timeout: as_string(group.check_timeout || "2s"),
        recovery_check_interval: as_string(group.recovery_check_interval || "15s"),
        pick_fastest: bool_value(group.pick_fastest, false),
        switch_to_faster_same_priority: bool_value(group.switch_to_faster_same_priority, false),
        fastest_check_interval: as_string(group.fastest_check_interval || "3m"),
        levels
    };
}

function section_cache_files() {
    if (fs.stat(SECTION_CACHE_DIR) == null)
        return [];
    let result = [];
    for (let path in split(command_output_from_args([
        "find",
        SECTION_CACHE_DIR,
        "-mindepth",
        "1",
        "-maxdepth",
        "1",
        "-type",
        "f",
        "-name",
        "*.json"
    ]), "\n")) {
        path = as_string(path);
        if (path != "")
            push(result, path);
    }
    return sort(result);
}

function priority_groups_from_cache() {
    let result = [];
    for (let path in section_cache_files()) {
        let cache = object_or_empty(read_json_file(path));
        for (let tag_name, group in object_or_empty(cache.priorityGroups)) {
            let normalized = normalize_group(group, tag_name);
            if (normalized.tag != "" && length(normalized.levels) > 0)
                push(result, normalized);
        }
    }
    return result;
}

function normalize_pin_guard_entry(entry, fallback_section, default_test_url) {
    entry = object_or_empty(entry);
    if (entry.pin_guard != null && !bool_value(entry.pin_guard, true))
        return null;
    if (entry.pinGuard != null && !bool_value(entry.pinGuard, true))
        return null;

    let section_name = trim(as_string(entry.section || fallback_section || ""));
    let uci_sec = section_name != "" ? object_or_empty(uci_core.get_all(CONFIG_NAME, section_name)) : {};
    if (uci_sec.enabled != null && !bool_value(uci_sec.enabled, true))
        return null;
    if (uci_sec.pin_guard != null && !bool_value(uci_sec.pin_guard, true))
        return null;

    let selector_tag = trim(as_string(entry.selectorTag || (section_name != "" ? runtime_constants.outbound_tag(section_name) : "")));
    if (selector_tag == "")
        return null;

    let urltest_tags = [];
    for (let tag in array_or_empty(entry.urltestTags))
        push(urltest_tags, tag);
    for (let tag in keys(object_or_empty(entry.urltestGroups)))
        push(urltest_tags, tag);

    let priority_tags = [];
    for (let tag in array_or_empty(entry.priorityTags))
        push(priority_tags, tag);
    for (let tag in keys(object_or_empty(entry.priorityGroups)))
        push(priority_tags, tag);

    urltest_tags = unique_strings(urltest_tags);
    priority_tags = unique_strings(priority_tags);

    if (entry.selectorTag == null && length(urltest_tags) == 0 && length(priority_tags) == 0)
        return null;

    let test_url = trim(as_string(entry.testUrl || entry.health_url || uci_sec.latency_test_url || default_test_url));
    if (test_url == "")
        test_url = "https://www.gstatic.com/generate_204";

    return {
        section: section_name,
        selectorTag: selector_tag,
        urltestTags: urltest_tags,
        priorityTags: priority_tags,
        testUrl: test_url
    };
}

function pin_guard_sections_from_cache() {
    let cfg = object_or_empty(uci_core.get_all(CONFIG_NAME, "settings"));
    if (cfg.pin_guard != null && !bool_value(cfg.pin_guard, true))
        return [];

    let default_test_url = trim(as_string(cfg.latency_test_url || "https://www.gstatic.com/generate_204"));
    let result = [];
    let seen = {};

    for (let path in section_cache_files()) {
        let cache = object_or_empty(read_json_file(path));
        let fallback_section = as_string(cache.section || cache_basename_section(path));

        if (type(cache.pinGuardSections) == "array") {
            for (let raw_entry in cache.pinGuardSections) {
                let normalized = normalize_pin_guard_entry(raw_entry, fallback_section, default_test_url);
                if (normalized != null && !seen[normalized.selectorTag]) {
                    seen[normalized.selectorTag] = true;
                    push(result, normalized);
                }
            }
            continue;
        }

        let normalized = normalize_pin_guard_entry(cache, fallback_section, default_test_url);
        if (normalized != null && !seen[normalized.selectorTag]) {
            seen[normalized.selectorTag] = true;
            push(result, normalized);
        }
    }

    return result;
}

function module_capture(args) {
    let output_path = trim(command_output_from_args([ "mktemp" ]));
    if (output_path == "")
        return { status: 1, output: "" };

    let command = command_from_args([ "ucode", "-L", LIB_DIR, DIAGNOSTICS_UC, "clash-api" ]);
    for (let arg in args)
        command += " " + shell_quote(arg);

    let status = command_status(command + " >" + shell_quote(output_path) + " 2>&1");
    let output = as_string(fs.readfile(output_path) || "");
    remove_file(output_path);
    return { status, output };
}

function parse_delay_output(output) {
    let value = null;
    try {
        value = json(output);
    }
    catch (e) {
        return null;
    }

    if (type(value) != "object")
        return null;

    let delay = value.delay;
    if (delay == null || as_string(delay) == "")
        return null;

    delay = int(delay, 10);
    return delay >= 0 ? delay : null;
}

function clash_probe(tag_name, group) {
    let timeout = as_string(duration_to_milliseconds(group.check_timeout, 2000));
    let result = module_capture([ "get_proxy_latency", tag_name, timeout, group.health_url ]);
    if (result.status != 0)
        return { alive: false, delay: 0 };

    let delay = parse_delay_output(result.output);
    if (delay == null)
        return { alive: false, delay: 0 };

    return { alive: true, delay };
}

function fetch_clash_proxies_map() {
    let result = module_capture([ "get_proxies" ]);
    if (result.status != 0 || trim(result.output) == "")
        return null;
    let parsed;
    try { parsed = json(result.output); }
    catch (e) { return null; }
    if (type(parsed) != "object" || type(parsed.proxies) != "object")
        return null;
    return parsed.proxies;
}

function find_pin_guard_fallback_group(entry, all_members, proxies) {
    for (let candidate in all_members) {
        candidate = as_string(candidate);
        if (candidate != "" && contains_string(entry.urltestTags, candidate))
            return candidate;
    }
    for (let candidate in all_members) {
        candidate = as_string(candidate);
        let ptype = lc(as_string(object_or_empty(proxies[candidate]).type || ""));
        if (candidate != "" && ptype == "urltest")
            return candidate;
    }
    for (let candidate in all_members) {
        candidate = as_string(candidate);
        if (candidate != "" && contains_string(entry.priorityTags, candidate))
            return candidate;
    }
    for (let candidate in all_members) {
        candidate = as_string(candidate);
        let ptype = lc(as_string(object_or_empty(proxies[candidate]).type || ""));
        if (candidate != "" && candidate != entry.selectorTag && ptype == "selector")
            return candidate;
    }
    return "";
}

function proxy_is_manual_leaf(entry, tag_name, fallback_tag, proxies) {
    tag_name = as_string(tag_name);
    if (tag_name == "" || tag_name == entry.selectorTag || tag_name == fallback_tag)
        return false;
    if (contains_string(entry.urltestTags, tag_name) || contains_string(entry.priorityTags, tag_name))
        return false;

    let proxy_obj = object_or_empty(proxies[tag_name]);
    let ptype = lc(as_string(proxy_obj.type || ""));
    if (ptype == "" || ptype == "urltest" || ptype == "selector" || ptype == "fallback" ||
        ptype == "loadbalance" || ptype == "direct" || ptype == "block" || ptype == "dns")
        return false;
    return true;
}

function init_pin_guard_state(existing) {
    let state = object_or_empty(existing);
    return {
        version: 1,
        sections: object_or_empty(state.sections),
        events: array_or_empty(state.events),
        updatedAt: int(state.updatedAt || 0)
    };
}

function append_pin_guard_event(state, event_item) {
    let events = array_or_empty(state.events);
    push(events, event_item);
    while (length(events) > PIN_GUARD_MAX_EVENTS)
        shift(events);
    state.events = events;
}

function tick_pin_guard(pin_state, entries) {
    if (length(entries) == 0)
        return false;

    let proxies = fetch_clash_proxies_map();
    if (proxies == null)
        return false;

    let now = now_seconds();
    let next_sections = {};

    for (let entry in entries) {
        let prev = object_or_empty(pin_state.sections[entry.selectorTag]);
        let selector = object_or_empty(proxies[entry.selectorTag]);
        if (lc(as_string(selector.type || "")) != "selector")
            continue;

        let active_now = as_string(selector.now || "");
        let all_members = array_or_empty(selector.all);
        let fallback_tag = find_pin_guard_fallback_group(entry, all_members, proxies);

        if (fallback_tag == "") {
            next_sections[entry.selectorTag] = {
                section: entry.section,
                selectorTag: entry.selectorTag,
                activeTag: active_now,
                fallbackTag: "",
                strikes: 0,
                status: "no_auto_group",
                updatedAt: now
            };
            continue;
        }

        if (!proxy_is_manual_leaf(entry, active_now, fallback_tag, proxies)) {
            next_sections[entry.selectorTag] = {
                section: entry.section,
                selectorTag: entry.selectorTag,
                activeTag: active_now,
                fallbackTag: fallback_tag,
                strikes: 0,
                status: "automatic",
                updatedAt: now
            };
            continue;
        }

        let probe_res = module_capture([ "get_proxy_latency", active_now, as_string(PIN_GUARD_TIMEOUT_MS), entry.testUrl ]);
        let delay = probe_res.status == 0 ? parse_delay_output(probe_res.output) : null;

        if (delay != null) {
            next_sections[entry.selectorTag] = {
                section: entry.section,
                selectorTag: entry.selectorTag,
                activeTag: active_now,
                fallbackTag: fallback_tag,
                strikes: 0,
                lastDelay: delay,
                status: "healthy",
                updatedAt: now
            };
            continue;
        }

        let prev_strikes = as_string(prev.activeTag) == active_now ? int(prev.strikes || 0) : 0;
        let strikes = prev_strikes + 1;

        if (strikes >= PIN_GUARD_STRIKES) {
            let sw = module_capture([ "set_group_proxy", entry.selectorTag, fallback_tag, "automatic" ]);
            if (sw.status == 0) {
                log_message("pin guard switched " + entry.selectorTag + " from dead pinned node " + active_now + " to " + fallback_tag, "warn");
                next_sections[entry.selectorTag] = {
                    section: entry.section,
                    selectorTag: entry.selectorTag,
                    activeTag: fallback_tag,
                    lastFailedTag: active_now,
                    fallbackTag: fallback_tag,
                    strikes: 0,
                    status: "failed_over",
                    switchedAt: now,
                    updatedAt: now
                };
                append_pin_guard_event(pin_state, {
                    section: entry.section,
                    selectorTag: entry.selectorTag,
                    failedTag: active_now,
                    fallbackTag: fallback_tag,
                    strikes,
                    at: now
                });
            }
            else {
                next_sections[entry.selectorTag] = {
                    section: entry.section,
                    selectorTag: entry.selectorTag,
                    activeTag: active_now,
                    fallbackTag: fallback_tag,
                    strikes,
                    status: "switch_failed",
                    updatedAt: now
                };
            }
        }
        else {
            next_sections[entry.selectorTag] = {
                section: entry.section,
                selectorTag: entry.selectorTag,
                activeTag: active_now,
                fallbackTag: fallback_tag,
                strikes,
                status: "degraded",
                updatedAt: now
            };
        }
    }

    pin_state.sections = next_sections;
    pin_state.updatedAt = now;
    atomic_write_json(PIN_GUARD_STATE_FILE, pin_state);
    return true;
}

function fixture_probe(latencies, tag_name) {
    let value = object_or_empty(latencies)[tag_name];
    if (value == null || as_string(value) == "" || int(value, 10) < 0)
        return { alive: false, delay: 0 };
    return { alive: true, delay: int(value, 10) };
}

function choose_from_level(group, level_index, probe, skip_tag) {
    let level = object_or_empty(array_or_empty(group.levels)[level_index]);
    let best = null;

    for (let tag_name in array_or_empty(level.outbounds)) {
        if (as_string(skip_tag) != "" && tag_name == skip_tag)
            continue;
        let result = probe(tag_name, group);
        if (!result.alive)
            continue;

        if (!group.pick_fastest)
            return {
                tag: tag_name,
                levelIndex: level_index,
                delay: result.delay
            };

        if (best == null || result.delay < best.delay)
            best = {
                tag: tag_name,
                levelIndex: level_index,
                delay: result.delay
            };
    }

    return best;
}

function choose_from_level_range(group, start_index, end_index, probe, skip_tag) {
    let levels = array_or_empty(group.levels);
    if (length(levels) == 0)
        return null;

    start_index = int(start_index || 0);
    end_index = int(end_index || 0);
    if (start_index < 0)
        start_index = 0;
    if (end_index >= length(levels))
        end_index = length(levels) - 1;
    if (start_index > end_index)
        return null;

    for (let i = start_index; i <= end_index; i++) {
        let selected = choose_from_level(group, i, probe, skip_tag);
        if (selected != null)
            return selected;
    }
    return null;
}

function choose_fastest_same_level(group, level_index, active_tag, probe) {
    let level = object_or_empty(array_or_empty(group.levels)[level_index]);
    let active = null;
    let best = null;

    for (let tag_name in array_or_empty(level.outbounds)) {
        let result = probe(tag_name, group);
        if (tag_name == active_tag)
            active = result;
        if (!result.alive)
            continue;
        if (best == null || result.delay < best.delay) {
            best = {
                tag: tag_name,
                levelIndex: level_index,
                delay: result.delay
            };
        }
    }

    if (best == null || best.tag == active_tag)
        return null;
    if (active == null || !active.alive || best.delay < active.delay)
        return best;
    return null;
}

function set_group_proxy(group, tag_name) {
    let result = module_capture([ "set_group_proxy", group.tag, tag_name, "automatic" ]);
    return result.status == 0;
}

function switch_group(state, group, selected) {
    if (selected == null || selected.tag == "")
        return false;

    if (state.active == selected.tag) {
        state.levelIndex = selected.levelIndex;
        state.activeDelay = selected.delay;
        return true;
    }

    if (!set_group_proxy(group, selected.tag)) {
        log_message("failed to switch " + group.tag + " to " + selected.tag, "warn");
        return false;
    }

    state.active = selected.tag;
    state.levelIndex = selected.levelIndex;
    state.activeDelay = selected.delay;
    return true;
}

function init_group_state(group) {
    return {
        active: "",
        levelIndex: -1,
        activeDelay: 0,
        nextActiveCheck: now_seconds(),
        nextRecoveryCheck: now_seconds() + duration_to_seconds(group.recovery_check_interval, 15),
        nextFastestCheck: now_seconds() + duration_to_seconds(group.fastest_check_interval, 180)
    };
}

function tick_group(state, group) {
    let now = now_seconds();

    if (state.active == "" && now >= state.nextActiveCheck) {
        let selected = choose_from_level_range(group, 0, length(group.levels) - 1, clash_probe);
        switch_group(state, group, selected);
        state.nextActiveCheck = now + duration_to_seconds(group.active_check_interval, 5);
        return;
    }

    if (state.active != "" && now >= state.nextActiveCheck) {
        let active = clash_probe(state.active, group);
        if (active.alive) {
            state.activeDelay = active.delay;
        }
        else {
            let selected = choose_from_level_range(
                group,
                state.levelIndex,
                length(group.levels) - 1,
                clash_probe,
                state.active
            );
            if (switch_group(state, group, selected)) {
                state.nextRecoveryCheck = now + duration_to_seconds(group.recovery_check_interval, 15);
                state.nextFastestCheck = now + duration_to_seconds(group.fastest_check_interval, 180);
            }
            else {
                state.active = "";
                state.levelIndex = -1;
            }
        }
        state.nextActiveCheck = now + duration_to_seconds(group.active_check_interval, 5);
    }

    if (state.active != "" && state.levelIndex > 0 && now >= state.nextRecoveryCheck) {
        let selected = choose_from_level_range(group, 0, state.levelIndex - 1, clash_probe);
        if (switch_group(state, group, selected))
            state.nextFastestCheck = now + duration_to_seconds(group.fastest_check_interval, 180);
        state.nextRecoveryCheck = now + duration_to_seconds(group.recovery_check_interval, 15);
    }

    if (state.active != "" && group.switch_to_faster_same_priority && now >= state.nextFastestCheck) {
        let selected = choose_fastest_same_level(group, state.levelIndex, state.active, clash_probe);
        if (selected != null)
            switch_group(state, group, selected);
        state.nextFastestCheck = now + duration_to_seconds(group.fastest_check_interval, 180);
    }
}

function pin_guard_tick_once() {
    let entries = pin_guard_sections_from_cache();
    if (length(entries) == 0)
        return 0;
    let pin_state = init_pin_guard_state(read_json_file(PIN_GUARD_STATE_FILE));
    tick_pin_guard(pin_state, entries);
    return 0;
}

function worker() {
    let groups = priority_groups_from_cache();
    let pin_guard_entries = pin_guard_sections_from_cache();
    if (length(groups) == 0 && length(pin_guard_entries) == 0)
        return 0;

    let states = {};
    for (let group in groups)
        states[group.tag] = init_group_state(group);

    let pin_state = init_pin_guard_state(read_json_file(PIN_GUARD_STATE_FILE));
    let next_pin_guard_check = now_seconds();

    while (true) {
        if (fs.stat(SECTION_CACHE_DIR) == null)
            return 0;
        for (let group in groups)
            tick_group(states[group.tag], group);

        let now = now_seconds();
        if (length(pin_guard_entries) > 0 && now >= next_pin_guard_check) {
            tick_pin_guard(pin_state, pin_guard_entries);
            next_pin_guard_check = now_seconds() + PIN_GUARD_INTERVAL;
        }
        system("sleep 1");
    }
}

function process_running(pid) {
    pid = trim(as_string(pid));
    return pid != "" && match(pid, /^[0-9]+$/) != null && command_success_from_args([ "kill", "-0", pid ]);
}

function stop_runtime() {
    let record = read_pid_record(PRIORITY_PID_FILE);
    if (process_running(record.pid) && pid_matches_recorded_ticks(record))
        command_success_from_args([ "kill", record.pid ]);
    remove_file(PRIORITY_PID_FILE);
    return 0;
}

function start_runtime() {
    let groups = priority_groups_from_cache();
    let pin_guard_entries = pin_guard_sections_from_cache();
    stop_runtime();
    if (length(groups) == 0 && length(pin_guard_entries) == 0) {
        remove_file(PIN_GUARD_STATE_FILE);
        return 0;
    }

    if (!ensure_dir(RUNTIME_STATE_DIR))
        return 1;

    let command = command_from_args([ "ucode", "-L", LIB_DIR, PRIORITY_UC, "worker" ]) +
        " >/dev/null 2>&1 1000>&- & echo $! >" + shell_quote(PRIORITY_PID_FILE);
    let status = command_status(command);
    if (status == 0) {
        let pid = file_first_line(PRIORITY_PID_FILE);
        let ticks = read_pid_start_ticks(pid);
        if (pid != "" && ticks != null)
            fs.writefile(PRIORITY_PID_FILE, pid + "\n" + ticks + "\n");
    }
    return status;
}

function select_fixture(group_path, latency_path, start_index, end_index, skip_tag) {
    let group = normalize_group(read_json_file(group_path), "fixture");
    let latencies = object_or_empty(read_json_file(latency_path));
    let selected = choose_from_level_range(group, start_index, end_index, function(tag_name, _group) {
        return fixture_probe(latencies, tag_name);
    }, skip_tag);
    write_json(selected == null ? {} : selected);
}

function select_faster_fixture(group_path, latency_path, level_index, active_tag) {
    let group = normalize_group(read_json_file(group_path), "fixture");
    let latencies = object_or_empty(read_json_file(latency_path));
    let selected = choose_fastest_same_level(group, int(level_index || 0), as_string(active_tag), function(tag_name, _group) {
        return fixture_probe(latencies, tag_name);
    });
    write_json(selected == null ? {} : selected);
}

let mode = ARGV[0] || "";

if (mode == "start-runtime")
    exit(start_runtime());
else if (mode == "stop-runtime")
    exit(stop_runtime());
else if (mode == "worker")
    exit(worker());
else if (mode == "pin-guard-tick")
    exit(pin_guard_tick_once());
else if (mode == "pin-guard-sections")
    write_json(pin_guard_sections_from_cache());
else if (mode == "select-fixture")
    select_fixture(ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5]);
else if (mode == "select-faster-fixture")
    select_faster_fixture(ARGV[1], ARGV[2], ARGV[3], ARGV[4]);
else {
    warn("Usage: singbox/priority.uc <start-runtime|stop-runtime|worker|pin-guard-tick|pin-guard-sections|select-fixture|select-faster-fixture>\n");
    exit(1);
}
