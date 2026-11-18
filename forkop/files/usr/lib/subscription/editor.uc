#!/usr/bin/env ucode

let fs = require("fs");
let common = require("core.common");
let core_ip = require("core.ip");
let subscription_cache = require("subscription.cache");
let runtime_urltest = require("singbox.urltest");

let as_string = common.as_string;
let array_or_empty = common.array_or_empty;
let object_or_empty = common.object_or_empty;

const LIB_DIR = getenv("FORKOP_LIB") || "/usr/lib/forkop";
const MAX_PREVIEW_SOURCES = 10;

function trim_str(value) {
    return trim(as_string(value));
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

function remove_tree(path) {
    path = as_string(path);
    if (path == "" || substr(path, 0, 5) != "/tmp/")
        return;

    let st = fs.lstat(path);
    if (!st)
        return;

    if (st.type != "directory") {
        fs.unlink(path);
        return;
    }

    let entries = fs.lsdir(path);
    if (type(entries) == "array") {
        for (let entry in entries) {
            entry = as_string(entry);
            if (entry == "" || entry == "." || entry == "..")
                continue;
            remove_tree(path + "/" + entry);
        }
    }
    fs.rmdir(path);
}

function print_error(code, message) {
    let payload = {
        success: false,
        error: as_string(code || "preview_failed"),
        message: as_string(message || "Subscription preview failed")
    };
    print(sprintf("%J\n", payload));
    return false;
}

function extract_url_host(url) {
    url = trim_str(url);
    let m = match(url, /^https?:\/\/([^\/?#]+)/i);
    if (!m)
        return "";
    let authority = m[1];
    let at_pos = rindex(authority, "@");
    let hostport = at_pos >= 0 ? substr(authority, at_pos + 1) : authority;
    if (substr(hostport, 0, 1) == "[") {
        let end_br = index(hostport, "]");
        return end_br > 1 ? substr(hostport, 1, end_br - 1) : "";
    }
    let colon = index(hostport, ":");
    return colon >= 0 ? substr(hostport, 0, colon) : hostport;
}

function disallowed_preview_url_host(host) {
    if (as_string(getenv("FORKOP_EDITOR_ALLOW_LOOPBACK") || "") == "1")
        return false;

    host = lc(trim_str(host));
    if (host == "" || host == "localhost" || match(host, /\.localhost$/) != null)
        return true;

    let norm = core_ip.normalize_ip(host);
    if (norm == null)
        return false;

    for (let cidr in [
        "0.0.0.0/8",
        "10.0.0.0/8",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "::/128",
        "::1/128",
        "fc00::/7",
        "fe80::/10"
    ]) {
        if (core_ip.ip_in_cidr(norm, cidr))
            return true;
    }
    return false;
}

function sanitize_display_name(raw_name, index_num) {
    let label = trim_str(raw_name);
    if (label == "")
        return "Server " + index_num;
    if (match(label, /^[A-Za-z][A-Za-z0-9+.-]*:\/\//) != null)
        return "Server " + index_num;
    if (index(label, "@") >= 0 && match(label, /[0-9a-fA-F-]{16,}|[A-Za-z0-9+\/]{24,}=*/) != null)
        return "Server " + index_num;
    return label;
}

function safe_section_id(raw_id) {
    let id = trim_str(raw_id);
    if (id != "" && match(id, /^[A-Za-z0-9_]{1,64}$/) != null)
        return id;
    return "preview";
}

function bool_flag(value, fallback) {
    if (value == null || value == "")
        return fallback ? "1" : "0";
    if (value === true || as_string(value) == "1" || lc(as_string(value)) == "true")
        return "1";
    return "0";
}

function normalize_source_item(raw_source, default_proxy_section) {
    if (type(raw_source) == "string") {
        let u = trim_str(raw_source);
        return {
            url: u,
            download_via_proxy_enabled: default_proxy_section != "" ? "1" : "0",
            download_via_proxy_section: default_proxy_section
        };
    }
    if (type(raw_source) != "object")
        return null;

    let out = {};
    for (let k in keys(raw_source))
        out[k] = raw_source[k];
    if (default_proxy_section != "" && out.download_via_proxy_enabled == null) {
        out.download_via_proxy_enabled = "1";
        out.download_via_proxy_section = default_proxy_section;
    }
    return out;
}

function preview(request_id) {
    request_id = trim_str(request_id);
    if (request_id == "" || match(request_id, /^[A-Za-z0-9_-]{1,64}$/) == null)
        return print_error("invalid_request_id", "Invalid preview request identifier");

    let ui_state_dir = getenv("FORKOP_UI_STATE_DIR") || "/var/run/forkop/ui-state";
    let req_path = ui_state_dir + "/" + request_id + ".json";
    let st = fs.lstat(req_path);
    if (st == null || st.type != "file") {
        if (st != null)
            fs.unlink(req_path);
        return print_error("request_not_found", "Preview request file not found");
    }

    let raw_req = fs.readfile(req_path);
    fs.unlink(req_path);

    if (raw_req == null || trim_str(raw_req) == "")
        return print_error("invalid_request", "Preview request payload is empty");

    let req = null;
    try {
        req = json(raw_req);
    }
    catch (e) {
        return print_error("invalid_json", "Preview request payload is not valid JSON");
    }

    if (type(req) != "object")
        return print_error("invalid_payload", "Preview request must be a JSON object");

    let section_id = safe_section_id(req.section_id || "preview");
    let raw_sources = array_or_empty(req.sources);
    let sec_draft = object_or_empty(req.section);
    let manual_links = array_or_empty(sec_draft.selector_proxy_links);
    let outbound_jsons = array_or_empty(sec_draft.outbound_jsons);
    let interfaces = array_or_empty(sec_draft.interfaces);
    let default_proxy_section = trim_str(req.section_proxy_for_downloads || "");

    if (length(raw_sources) > MAX_PREVIEW_SOURCES)
        return print_error("too_many_sources", "Too many subscription sources for preview (maximum " + MAX_PREVIEW_SOURCES + ")");

    if (length(raw_sources) == 0 && length(manual_links) == 0 && length(outbound_jsons) == 0 && length(interfaces) == 0)
        return print_error("no_sources", "No subscription sources or connections provided for preview");

    let stamp = clock();
    let workspace = sprintf("/tmp/forkop-editor-preview-%s-%d-%d", request_id, stamp[0], stamp[1]);
    if (!common.secure_private_dir(workspace))
        return print_error("workspace_failed", "Failed to create secure temporary preview workspace");

    let sub_dir = workspace + "/subscriptions";
    let sec_cache_dir = workspace + "/section-cache";
    let ruleset_dir = workspace + "/rulesets";
    if (!common.secure_private_dir(sub_dir) ||
        !common.secure_private_dir(sec_cache_dir) ||
        !common.secure_private_dir(ruleset_dir)) {
        remove_tree(workspace);
        return print_error("workspace_failed", "Failed to initialize preview subdirectories");
    }

    let sub_url_sections = [];
    let source_urls_list = [];
    let source_index = 0;

    for (let raw_src in raw_sources) {
        let src = normalize_source_item(raw_src, default_proxy_section);
        if (src == null)
            continue;
        let url = trim_str(src.url || "");
        if (url == "")
            continue;
        if (match(url, /^https?:\/\//i) == null) {
            remove_tree(workspace);
            return print_error("invalid_source_url", "Subscription URL must start with http:// or https://");
        }
        let host = extract_url_host(url);
        if (disallowed_preview_url_host(host)) {
            remove_tree(workspace);
            return print_error("disallowed_source_host", "Subscription host is not allowed for preview");
        }

        source_index++;
        let source_section = section_id + "-subscription-" + source_index;
        src.section_id = section_id;
        let dl = subscription_cache.editor_download_source(src, source_section, sub_dir);
        if (type(dl) != "object" || dl.ok !== true) {
            remove_tree(workspace);
            return print_error(
                as_string(object_or_empty(dl).error || "download_failed"),
                as_string(object_or_empty(dl).message || "Failed to download subscription source")
            );
        }

        let prefix = trim_str(src.prefix != null ? src.prefix : src.node_prefix);
        let custom_ua = trim_str(src.user_agent || "");
        let hwid_auto = src.hwid_auto === true || as_string(src.hwid_auto) == "1" || trim_str(src.hwid || "") == "";
        let child = {
            ".name": "sub_prev_" + source_index,
            ".type": "subscription_url",
            section: section_id,
            url,
            include_urltest_groups: bool_flag(src.include_urltest_groups, false),
            hide_urltest_group_outbounds: bool_flag(src.hide_urltest_group_outbounds, false),
            hide_detour_outbounds: bool_flag(src.hide_detour_outbounds, true),
            prefix_nodes: prefix != "" ? "1" : "0",
            node_prefix: prefix,
            auto_user_agent: custom_ua != "" ? "0" : "1",
            user_agent: custom_ua,
            auto_hwid: hwid_auto ? "1" : "0",
            hwid: hwid_auto ? "" : trim_str(src.hwid || "")
        };
        push(sub_url_sections, child);
        push(source_urls_list, url);
    }

    let detect_country = trim_str(sec_draft.detect_server_country || "flag_emoji");
    if (detect_country == "")
        detect_country = "flag_emoji";

    let sec_obj = {
        ".name": section_id,
        ".type": "section",
        enabled: "1",
        action: "connection",
        domain_suffix: [ "preview.invalid" ],
        detect_server_country: detect_country,
        dashboard_detect_server_country: detect_country
    };
    if (length(source_urls_list) > 0)
        sec_obj.subscription_urls = source_urls_list;
    if (length(manual_links) > 0)
        sec_obj.selector_proxy_links = manual_links;
    if (length(outbound_jsons) > 0)
        sec_obj.outbound_jsons = outbound_jsons;
    if (length(interfaces) > 0)
        sec_obj.interfaces = interfaces;

    let fixture_obj = {
        settings: {
            ".name": "settings",
            ".type": "settings",
            dns_type: "udp",
            dns_server: [ "1.1.1.1" ],
            bootstrap_dns_server: [ "8.8.8.8" ],
            cache_path: workspace + "/cache.db"
        },
        section: [ sec_obj ],
        subscription_url: sub_url_sections
    };

    let fixture_path = workspace + "/fixture.json";
    let config_out_path = workspace + "/config.json";
    if (!common.write_private_json_file(fixture_path, fixture_obj)) {
        remove_tree(workspace);
        return print_error("workspace_failed", "Failed to write temporary preview fixture");
    }

    let gen_cmd = join(" ", [
        "TMP_SUBSCRIPTION_FOLDER=" + shell_quote(sub_dir),
        "FORKOP_SECTION_CACHE_DIR=" + shell_quote(sec_cache_dir),
        "TMP_RULESET_FOLDER=" + shell_quote(ruleset_dir),
        command_from_args([
            "ucode", "-L", LIB_DIR,
            LIB_DIR + "/singbox/generator.uc",
            "generate-config-fixture",
            fixture_path,
            config_out_path,
            "wan",
            "1"
        ])
    ]) + " >/dev/null 2>&1";

    let gen_rc = system(gen_cmd);
    let cache_data = common.read_json_file(sec_cache_dir + "/" + section_id + ".json");
    remove_tree(workspace);

    if (gen_rc != 0 || type(cache_data) != "object")
        return print_error("generation_failed", "No usable proxy servers were produced by the configured sources");

    let meta = object_or_empty(cache_data.outboundMetadata);
    let names_map = object_or_empty(meta.names);
    let countries_map = object_or_empty(meta.countries);
    if (detect_country == "flag_emoji" || length(keys(countries_map)) == 0) {
        let flag_countries = object_or_empty(runtime_urltest.countries_from_flag_names(names_map));
        for (let k in keys(flag_countries)) {
            if (countries_map[k] == null || as_string(countries_map[k]) == "")
                countries_map[k] = flag_countries[k];
        }
    }

    let candidate_tags = array_or_empty(cache_data.urltestCandidateTags);
    if (length(candidate_tags) == 0)
        candidate_tags = array_or_empty(cache_data.selectorOutbounds);
    if (length(candidate_tags) == 0)
        candidate_tags = keys(names_map);

    let urltest_groups = object_or_empty(cache_data.urltestGroups);
    let priority_groups = object_or_empty(cache_data.priorityGroups);

    let names = [];
    let seen_names = {};
    let countries = {};
    let idx = 0;

    for (let tag in candidate_tags) {
        tag = as_string(tag);
        if (tag == "" || urltest_groups[tag] != null || priority_groups[tag] != null)
            continue;
        idx++;
        let raw_display = names_map[tag] != null ? names_map[tag] : tag;
        let safe_name = sanitize_display_name(raw_display, idx);
        if (!seen_names[safe_name]) {
            seen_names[safe_name] = true;
            push(names, safe_name);
        }
        let cc = uc(trim_str(countries_map[tag] || ""));
        if (match(cc, /^[A-Z]{2}$/) != null && countries[safe_name] == null)
            countries[safe_name] = cc;
    }

    let count = length(names);
    let response = {
        success: true,
        names,
        countries,
        count,
        data: {
            names,
            countries,
            count
        }
    };
    print(sprintf("%J\n", response));
    return true;
}

if ((sourcepath(1) != null && sourcepath(1) != "") || SCRIPT_NAME != sourcepath(0)) {
    return {
        preview
    };
}

let arg0 = ARGV[0] || "";
let req_arg = arg0 == "preview" ? ARGV[1] : arg0;
exit(preview(req_arg) ? 0 : 1);
