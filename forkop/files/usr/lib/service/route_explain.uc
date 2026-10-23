#!/usr/bin/ucode
// Configured-policy analysis only. Never performs DNS, downloads or probes.
// Three-valued matching follows the conservative approach in Trafira route_match.
let uci = require("core.uci");
let common = require("core.common");
let rules = require("config.rule");
let domains = require("config.domain");
let ip = require("core.ip");
let target = require("singbox.route");
let option = common.option;
let list = common.list_option;
let package_name = getenv("FORKOP_CONFIG_NAME") || "forkop";

function values(section, key) {
    if (common.bool_option(section, key + "_text_mode", false) || common.bool_option(section, "conditions_text_mode", false))
        return rules.text_list_values(option(section, key + "_text", ""), "comma-space");
    let raw = section[key];
    if (type(raw) == "array") return raw;
    if (key != "domain" && option(section, key, "") != "")
        return rules.text_list_values(option(section, key, ""), "comma-space");
    return rules.text_list_values(option(section, key + "_text", ""), "comma-space");
}

function ipv4_number(value) {
    let result = 0;
    for (let octet in split(value, ".")) result = result * 256 + int(octet);
    return result;
}

function address_match(actual, candidates) {
    if (actual == null) return "unknown";
    let unknown = false;
    for (let candidate in candidates) {
        if (!ip.valid_ip_or_cidr(candidate)) { unknown = true; continue; }
        let parts = split(candidate, "/");
        if (length(parts) == 1) { if (lc(actual) == lc(candidate)) return "yes"; continue; }
        if (ip.valid_ipv4(actual, false, false) && ip.valid_ipv4(parts[0], false, false)) {
            let divisor = 1;
            for (let bit = int(parts[1]); bit < 32; bit++) divisor *= 2;
            if (int(ipv4_number(actual) / divisor) == int(ipv4_number(parts[0]) / divisor)) return "yes";
        }
        else unknown = true;
    }
    return unknown ? "unknown" : "no";
}

function domain_match(section, actual) {
    let candidates = [], unknown = false;
    for (let key in ["domain", "domain_keyword", "domain_regex"])
        for (let value in values(section, key)) push(candidates, {kind:key, value});
    let combined = rules.text_list_values(option(section, "domain_suffix_text", ""), "comma-space");
    for (let value in list(section, "domain_suffix")) push(combined, value);
    if (type(section.domain) != "array")
        for (let value in rules.text_list_values(option(section, "domain", ""), "comma-space")) push(combined, value);
    for (let value in combined) {
        let parsed = rules.prefixed_domain_kind_value(value);
        if (parsed != null) push(candidates, parsed);
    }
    if (!length(candidates)) return null;
    if (actual == null) return "unknown";
    for (let candidate in candidates) {
        let value = domains.suffix_to_ascii(candidate.value);
        if (candidate.kind == "domain_regex") { unknown = true; continue; }
        if (candidate.kind == "domain_keyword") {
            if (index(actual, lc(candidate.value)) >= 0) return "yes";
        }
        else if (value != null && (actual == value || (candidate.kind == "domain_suffix" &&
                 length(actual) > length(value) && substr(actual, length(actual) - length(value) - 1) == "." + value))) return "yes";
    }
    return unknown ? "unknown" : "no";
}

function port_match(section, port) {
    let candidates = list(section, "ports");
    for (let value in rules.text_list_values(option(section, "ports_text", ""), "comma-space")) push(candidates, value);
    if (!length(candidates)) return null;
    if (port == null) return "unknown";
    for (let value in candidates) {
        let bounds = split(value, "-");
        if (length(bounds) == 1 && int(value) == port) return "yes";
        if (length(bounds) == 2 && port >= int(bounds[0]) && port <= int(bounds[1])) return "yes";
    }
    return "no";
}

function section_match(section, request) {
    let checks = [], missing = [], destination = domain_match(section, request.domain);
    let addresses = values(section, "ip_cidr");
    if (length(addresses)) {
        let address = address_match(request.destination_ip, addresses);
        if (destination == "yes" || address == "yes") destination = "yes";
        else if (destination == "unknown" || address == "unknown") destination = "unknown";
        else destination = "no";
    }
    if (destination != null) { push(checks, destination); if (destination == "unknown") push(missing, "destination"); }
    let source = values(section, "source_ip_cidr");
    if (length(source)) { let value = address_match(request.device, source); push(checks, value); if (value == "unknown") push(missing, "device"); }
    let port = port_match(section, request.port);
    if (port != null) { push(checks, port); if (port == "unknown") push(missing, "port"); }
    let has_set = false;
    for (let key in ["rule_set", "rule_set_with_subnets", "community_lists", "domain_ip_lists"])
        if (length(list(section, key))) has_set = true;
    if (has_set) { push(checks, "unknown"); push(missing, "rule_set"); }
    if (index(checks, "no") >= 0) return {value:"no", missing:[]};
    // A source-only section generates no combined sing-box route.
    if (destination == null && port == null && !has_set) return {value:"no", missing:[]};
    return {value:index(checks, "unknown") >= 0 ? "unknown" : "yes", missing};
}

function explain(raw) {
    let request;
    try { request = json(raw); } catch (e) { return {success:false,error:"invalid_request"}; }
    if (type(request) != "object" || length(raw) > 4096) return {success:false,error:"invalid_request"};
    if (request.domain != null) {
        if (type(request.domain) != "string") return {success:false,error:"invalid_request"};
        request.domain = domains.suffix_to_ascii(replace(request.domain, /[.]$/, ""));
        if (request.domain == null) return {success:false,error:"invalid_request"};
    }
    if (request.domain == null && request.destination_ip == null) return {success:false,error:"invalid_request"};
    for (let key in ["device", "destination_ip"])
        if (request[key] != null && (type(request[key]) != "string" || !ip.valid_ip(request[key]))) return {success:false,error:"invalid_request"};
    if (request.port != null && (type(request.port) != "int" || request.port < 1 || request.port > 65535)) return {success:false,error:"invalid_request"};
    if (request.protocol != null && index(["tcp", "udp", "quic", "dns"], request.protocol) < 0) return {success:false,error:"invalid_request"};
    if (!uci.available()) return {success:false,error:"uci_unavailable"};
    let settings = uci.get_all(package_name, "settings") || {}, trace = [];
    let data = {scope:"configured", connectivity_tested:false, capture_verified:false, request,
                decision:{status:"direct",section:null,outbound:"direct-out"}, trace, missing:[]};
    if (common.bool_option(settings, "exclude_ntp", false) && request.port == 123 && request.protocol == "udp") {
        push(trace, {section:null,match:"yes",reason:"exclude_ntp"});
        return {success:true,data};
    }
    if (request.port == 53 || request.protocol == "dns") {
        data.decision = {status:"matched",section:null,outbound:"dns"};
        push(trace, {section:null,match:"yes",reason:"hijack_dns"});
        return {success:true,data};
    }
    if (common.bool_option(settings, "disable_quic", false) && request.protocol == "quic") {
        data.decision = {status:"blocked",section:null,outbound:null};
        push(trace, {section:null,match:"yes",reason:"disable_quic"});
        return {success:true,data};
    }
    if (request.domain == require("singbox.constants").CHECK_PROXY_IP_DOMAIN) {
        for (let section in uci.section_objects(package_name,"section")) {
            if (!common.bool_option(section,"enabled",true) || option(section,"next_target","") != "") continue;
            if (index(["connection","proxy","outbound","vpn","byedpi","zapret","zapret2"],option(section,"action","")) < 0) continue;
            let route=target.target(section,section[".name"]+"-out");
            data.decision={status:"matched",section:section[".name"],outbound:route.outbound};
            push(trace,{section:section[".name"],match:"yes",reason:"service_ip_check"});
            return {success:true,data};
        }
    }
    let count = 0;
    for (let section in uci.section_objects(package_name, "section")) {
        if (!common.bool_option(section, "enabled", true) || option(section,"action","") == "dns") continue;
        let expires = option(section, "next_expires", "");
        if (expires != "" && match(expires, /^[0-9]+$/) && int(expires) > 0 && int(expires) <= time()) {
            push(trace, {section:section[".name"],match:"no",reason:"expired"});
            continue;
        }
        if (++count > 200) { data.decision.status = "indeterminate"; data.missing = ["evaluation_limit"]; break; }
        let fully = list(section, "fully_routed_ips"), evaluated = null;
        if (length(fully)) {
            let matched = address_match(request.device, fully);
            push(trace, {section:section[".name"],match:matched,reason:"fully_routed_ips"});
            if (matched != "no") evaluated = {value:matched,missing:matched == "unknown" ? ["device"] : []};
        }
        if (evaluated == null) evaluated = section_match(section, request);
        push(trace, {section:section[".name"],match:evaluated.value,reason:"section_conditions"});
        if (evaluated.value == "no") continue;
        if (evaluated.value == "unknown") {
            data.decision = {status:"indeterminate",section:section[".name"],outbound:null}; data.missing = evaluated.missing; break;
        }
        let route = target.target(section, section[".name"] + "-out");
        data.decision = {status:route.unsupported ? "indeterminate" : route.action == "reject" ? "blocked" : route.outbound == "bypass-out" ? "direct" : "matched",
                         section:section[".name"],outbound:route.outbound || null};
        if (route.unsupported) data.missing = ["unsupported_action"];
        break;
    }
    return {success:true,data};
}

print(sprintf("%J\n", ARGV[0] == "explain" ? explain(ARGV[1] || "") : {success:false,error:"invalid_command"}));
