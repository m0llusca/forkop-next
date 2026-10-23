// Recommendation-only detection. This module never writes routing configuration.
let fs = require("fs");
const PATH = getenv("FORKOP_SMART_DETECT_FILE") || "/var/run/forkop/recommendations.json";
const MAX_BYTES = 131072;
const MAX_ITEMS = 200;
const TTL = 86400;
const CONFIRM_WINDOW = 120;

function failure(error) { return { success: false, error }; }
function now() { return int(getenv("FORKOP_SMART_DETECT_NOW") || clock()[0]); }
function domain(value) {
    if (type(value) != "string" || length(value) > 253) return null;
    value = lc(trim(value));
    if (substr(value, -1) == ".") value = substr(value, 0, length(value) - 1);
    if (!match(value, /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/) || index(value, ".") < 0 || index(value, "..") >= 0)
        return null;
    for (let label in split(value, "."))
        if (length(label) > 63 || substr(label, 0, 1) == "-" || substr(label, -1) == "-") return null;
    if (match(value, /^[0-9.]+$/) || match(value, /\.(ru|su|by|kz|xn--p1ai|local|lan|home|internal|arpa|localhost)$/)) return null;
    if (match(value, /(^|\.)(sber|sberbank|tbank|tinkoff|alfabank|vtb|gosuslugi|yandex|ya)\.(com|net|org)$/)) return null;
    return value;
}
function read_state() {
    let info = fs.lstat(PATH);
    if (!info) return {};
    if (info.type != "file" || info.size > MAX_BYTES) return null;
    try {
        let data = json(fs.readfile(PATH));
        return type(data) == "object" ? data : null;
    } catch (e) { return null; }
}
function save(state) {
    let text = sprintf("%J", state);
    if (length(text) > MAX_BYTES) return false;
    let temporary = PATH + ".stage", info = fs.lstat(temporary);
    if (info && (info.type != "file" || !fs.unlink(temporary))) return false;
    let file = fs.open(temporary, "wex", 384);
    if (!file) return false;
    let ok = file.write(text) == length(text);
    file.flush(); file.close();
    if (ok && fs.readfile(temporary) == text && fs.rename(temporary, PATH)) return true;
    fs.unlink(temporary); return false;
}
function clean(state, stamp) {
    for (let id, item in state)
        if (type(item) != "object" || !domain(item.domain) || type(item.last_seen) != "int" ||
            stamp < item.last_seen || stamp - item.last_seen >= TTL) delete state[id];
}
function public_item(item) {
    return {
        id: item.id, domain: item.domain, status: item.status,
        observations: item.observations, first_seen: item.first_seen,
        current_route_failures: item.observations, proxy_successes: item.observations,
        last_seen: item.last_seen, expires_at: item.last_seen + TTL,
        evidence: { current_route_failed: true, proxy_succeeded: true, minimum_spacing_seconds: CONFIRM_WINDOW }
    };
}
function dispatch(action, payload, state, stamp) {
    if (action == "recommendations") {
        let result = [];
        for (let id, item in state) if (item.status == "pending") push(result, public_item(item));
        return { success: true, data: { recommendations: result } };
    }
    if (action == "recommendation_record") {
        let host = domain(payload.domain);
        if (!host) return failure("protected_or_invalid_domain");
        if (type(payload.direct_ok) != "bool" || type(payload.proxy_ok) != "bool") return failure("invalid_probe_evidence");
        let id = "domain:" + host, previous = state[id];
        if (type(previous) == "object" && (previous.status == "dismissed" || previous.status == "accepted"))
            return { success: true, data: { status: previous.status } };
        if (payload.direct_ok || !payload.proxy_ok) {
            delete state[id];
            return { success: true, data: { status: "clear" } };
        }
        if (type(previous) != "object") {
            if (length(keys(state)) >= MAX_ITEMS) return failure("recommendation_limit");
            previous = { id, domain: host, first_seen: stamp, last_seen: stamp, observations: 0, status: "observing" };
        }
        // Replaying the same observation cannot qualify as repeated evidence.
        if (previous.observations == 0 || stamp > previous.last_seen) previous.observations++;
        previous.last_seen = stamp;
        if (stamp - previous.first_seen >= CONFIRM_WINDOW && previous.observations >= 2) previous.status = "pending";
        state[id] = previous;
        return { success: true, data: { status: previous.status } };
    }
    let item = type(payload.id) == "string" ? state[payload.id] : null;
    if (type(item) != "object" || item.status != "pending") return failure("recommendation_not_pending");
    if (action == "recommendation_dismiss") {
        item.status = "dismissed"; item.last_seen = stamp;
        return { success: true, data: { status: "dismissed" } };
    }
    if (action == "recommendation_accept") {
        if (type(payload.section) != "string" || !match(payload.section, /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/))
            return failure("invalid_section");
        // Caller must use the safe configuration transaction before mark_accepted().
        return { success: true, data: { suggestion: { section: payload.section, domain: item.domain, kind: "domain" } } };
    }
    if (action == "recommendation_complete") {
        item.status = "accepted"; item.last_seen = stamp;
        return { success: true, data: { status: "accepted" } };
    }
    return failure("unknown_recommendation_action");
}
function handle(action, payload) {
    if (type(payload) != "object") return failure("invalid_payload");
    if (action == "recommendation_tick") {
        let common = require("core.common"), uci = require("core.uci");
        let configured = common.object_or_empty(uci.get_all(getenv("FORKOP_CONFIG_NAME") || "forkop", "settings"));
        if (!common.bool_option(configured, "smart_detect_enabled", false))
            return { success: true, data: { enabled: false, scanned: 0 } };
        let section = common.option(configured, "smart_detect_section", "");
        if (section == "") return failure("smart_detect_section_required");
        let pipe = fs.popen("timeout 3 logread -l 200 2>/dev/null", "r");
        if (!pipe) return failure("smart_detect_logs_unavailable");
        let text = pipe.read(65536) || "", status = pipe.close();
        if (status != 0) return failure("smart_detect_logs_unavailable");
        let candidates = [];
        for (let line in split(text, "\n")) {
            if (!match(line, /outbound\/direct\[(direct-out|bypass-out)\]/)) continue;
            let found = match(line, /outbound connection to ([A-Za-z0-9.-]+):[0-9]+/);
            let host = found ? domain(found[1]) : null;
            if (host && index(candidates, host) < 0 && length(candidates) < 20) push(candidates, host);
        }
        if (length(candidates) == 0) return { success: true, data: { enabled: true, scanned: 0 } };
        // At most one domain/two bounded requests per minute; rotate noisy clients.
        let selected = candidates[int(now() / 60) % length(candidates)];
        let result = handle("recommendation_scan", { domain: selected, section });
        if (!result.success) return result;
        return { success: true, data: { enabled: true, scanned: 1, domain: selected, observation: result.data.observation } };
    }
    if (action == "recommendation_scan") {
        if (!domain(payload.domain) || type(payload.section) != "string") return failure("invalid_recommendation_probe");
        let probe = require("service.probe");
        let current = probe.handle({ domain: payload.domain });
        let alternate = probe.handle({ domain: payload.domain, section: payload.section });
        if (!current.success) return current;
        if (!alternate.success) return alternate;
        let recorded = handle("recommendation_record", { domain: payload.domain,
            direct_ok: current.data.reachable && current.data.http_status < 400,
            proxy_ok: alternate.data.reachable && alternate.data.http_status < 400 });
        if (!recorded.success) return recorded;
        return { success: true, data: { current: current.data, section: alternate.data, observation: recorded.data } };
    }
    let parent = substr(PATH, 0, rindex(PATH, "/"));
    if (!fs.stat(parent) && !fs.mkdir(parent, 448)) return failure("recommendation_storage_unavailable");
    let info = fs.lstat(PATH + ".lock");
    if (info && info.type != "file") return failure("recommendation_storage_unavailable");
    let lock = fs.open(PATH + ".lock", "ae", 384);
    if (!lock || !lock.lock("x")) { if (lock) lock.close(); return failure("recommendation_busy"); }
    let result;
    try {
        let state = read_state();
        if (state == null) result = failure("invalid_recommendation_storage");
        else {
            let stamp = now(); clean(state, stamp);
            result = dispatch(action, payload, state, stamp);
            if (result.success && !save(state)) result = failure("recommendation_save_failed");
        }
    } catch (e) { result = failure("recommendation_failed"); }
    lock.close(); return result;
}
return { handle };
