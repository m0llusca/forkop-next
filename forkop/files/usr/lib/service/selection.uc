// Durable explicit choices; automatic health changes never write this file.
let fs = require("fs");
let common = require("core.common");
let sha256 = require("core.sha256");
let filter_identity = require("singbox.filter_identity");

const FILE = getenv("FORKOP_SELECTION_FILE") || "/etc/forkop/selections.json";

function as_string(value) {
    return common.as_string(value);
}

function choice_id(item) {
    if (type(item) != "object" || item == null)
        return null;
    if (lc(as_string(item.type || "")) == "direct")
        return "builtin:direct";
    let cid = filter_identity.connection_id(item);
    return cid != "" ? cid : null;
}

function tag_digest(tag) {
    tag = as_string(tag);
    return tag != "" ? "tag1:" + substr(sha256.digest(tag), 0, 24) : "";
}

function item_stem_digest(tag, item) {
    let label = type(item) == "object" && as_string(item.remark || "") != ""
        ? as_string(item.remark)
        : as_string(tag);
    let stem = filter_identity.canonical_label(label);
    return stem != "" ? "stem1:" + substr(sha256.digest(stem), 0, 24) : "";
}

function collect_members(config) {
    let members = {};
    if (type(config) != "object" || config == null)
        return members;

    for (let item in common.array_or_empty(config.outbounds)) {
        if (type(item) == "object" && as_string(item.tag || "") != "")
            members[item.tag] = item;
    }
    for (let item in common.array_or_empty(config.endpoints)) {
        if (type(item) == "object" && as_string(item.tag || "") != "")
            members[item.tag] = item;
    }
    return members;
}

function read() {
    try {
        let s = fs.lstat(FILE);
        return s && s.type == "file" && s.size < 65536 ? json(fs.readfile(FILE)) : {};
    }
    catch (e) {
        return {};
    }
}

function remember(group, proxy, config, origin) {
    if (origin && origin != "manual")
        return { success: true, skipped: true };
    if (type(config) != "object" || config == null)
        return { success: false, error: "invalid_selection" };

    let members = collect_members(config);
    let selector = null;
    for (let item in common.array_or_empty(config.outbounds)) {
        if (type(item) == "object" && item.tag == group) {
            selector = item;
            break;
        }
    }

    if (!selector || selector.type != "selector" || index(selector.outbounds || [], proxy) < 0)
        return { success: false, error: "invalid_selection" };

    let target = members[proxy];
    let fingerprint = choice_id(target);
    if (!fingerprint)
        return { success: false, error: "identity_failed" };

    let slash = rindex(FILE, "/");
    if (slash > 0) {
        let parent = substr(FILE, 0, slash);
        let info = fs.lstat(parent);
        if (info && info.type != "directory") {
            let st = fs.stat(parent);
            if (!st || st.type != "directory")
                return { success: false, error: "storage_unavailable" };
        }
        if (!info && !common.secure_private_dir(parent))
            return { success: false, error: "storage_unavailable" };
    }

    let lock = fs.open(FILE + ".lock", "ae", 0o600);
    if (!lock || !lock.lock("xn"))
        return { success: false, error: "busy" };

    let choices = read();
    if (type(choices) != "object")
        choices = {};

    choices[group] = {
        fingerprint,
        tag_hash: tag_digest(proxy),
        stem_hash: item_stem_digest(proxy, target)
    };

    let good = common.write_private_json_file(FILE, choices);
    lock.close();
    return { success: !!good };
}

function apply(config) {
    if (type(config) != "object" || config == null)
        return config;

    let choices = read();
    if (type(choices) != "object" || length(keys(choices)) == 0)
        return config;

    let members = collect_members(config);
    for (let selector in common.array_or_empty(config.outbounds)) {
        if (type(selector) != "object" || selector.type != "selector")
            continue;
        let saved = choices[selector.tag];
        if (type(saved) != "object" || !saved.fingerprint)
            continue;

        let candidates = common.array_or_empty(selector.outbounds);
        let matched = false;

        // Pass 1: Exact connection_id / choice_id match
        for (let candidate in candidates) {
            if (members[candidate] && choice_id(members[candidate]) == saved.fingerprint) {
                selector.default = candidate;
                matched = true;
                break;
            }
        }
        if (matched)
            continue;

        // Pass 2: Unambiguous canonical_label fallback ONLY when BOTH exact tag and connection_id changed
        if (!saved.stem_hash || !saved.tag_hash)
            continue;

        let exact_tag_reused = false;
        let stem_matches = [];
        for (let candidate in candidates) {
            if (tag_digest(candidate) == saved.tag_hash) {
                exact_tag_reused = true;
                break;
            }
            let member = members[candidate];
            if (!member || !choice_id(member))
                continue;
            if (item_stem_digest(candidate, member) == saved.stem_hash)
                push(stem_matches, candidate);
        }

        if (!exact_tag_reused && length(stem_matches) == 1)
            selector.default = stem_matches[0];
    }

    return config;
}

return { remember, apply, choice_id };
