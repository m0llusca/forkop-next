#!/usr/bin/env ucode

let fs = require("fs");
let ip = require("core.ip");
let domain_config = require("config.domain");

function as_string(value) {
    return value == null ? "" : "" + value;
}

function json_decode_text(text) {
    try {
        return json(as_string(text));
    }
    catch (e) {
        return null;
    }
}

function read_json_file(path) {
    let data = fs.readfile(path);
    return data == null ? null : json_decode_text(data);
}

function write_text_file(path, text) {
    let result = fs.writefile(path, text);
    if (result == null)
        return false;
    if (type(result) == "boolean" && !result)
        return false;
    return true;
}

function write_json_file(path, value) {
    return write_text_file(path, sprintf("%J", value) + "\n");
}

function array_or_empty(value) {
    return type(value) == "array" ? value : [];
}

function array_from_value(value) {
    if (value == null)
        return [];
    if (type(value) == "array")
        return value;
    return [ value ];
}

function object_or_empty(value) {
    return type(value) == "object" ? value : {};
}

function trim_string(value) {
    let text = as_string(value);
    let start_match = match(text, /^[ \t\r\n]*/);
    let start = start_match ? length(start_match[0]) : 0;
    let end = length(text);

    while (end > start && match(substr(text, end - 1, 1), /[ \t\r\n]/))
        end--;

    return substr(text, start, end - start);
}

function sort_values(values) {
    sort(values, function(first, second) {
        first = sprintf("%J", first);
        second = sprintf("%J", second);
        return first == second ? 0 : (first < second ? -1 : 1);
    });
    return values;
}

function unique_values(values) {
    values = sort_values(values);
    let result = [];
    let previous = null;
    let has_previous = false;

    for (let value in values) {
        let encoded = sprintf("%J", value);
        if (!has_previous || encoded != previous) {
            push(result, value);
            previous = encoded;
            has_previous = true;
        }
    }

    return result;
}

function create_source(path) {
    if (!write_json_file(path, { version: 3, rules: [] }))
        exit(1);
}

function ruleset_tag(section, name, kind) {
    kind = as_string(kind);
    return kind == ""
        ? as_string(section) + "-" + as_string(name) + "-ruleset"
        : as_string(section) + "-" + as_string(name) + "-" + kind + "-ruleset";
}

function patch_source_values(path, key, values) {
    let ruleset = object_or_empty(read_json_file(path));
    values = array_or_empty(values);

    if (type(ruleset.rules) != "array")
        ruleset.rules = [];

    let found = false;
    for (let rule in ruleset.rules) {
        if (type(rule) == "object" && rule[key] != null) {
            let merged = [];
            for (let item in array_or_empty(rule[key]))
                push(merged, item);
            for (let item in values)
                push(merged, item);
            rule[key] = unique_values(merged);
            found = true;
            break;
        }
    }

    if (!found) {
        let rule = {};
        rule[key] = values;
        push(ruleset.rules, rule);
    }

    if (!write_json_file(path, ruleset))
        exit(1);
}

function patch_source(path, key, value_text) {
    patch_source_values(path, key, json_decode_text(value_text));
}

function normalize_plain_ruleset_value(value, kind) {
    if (kind == "domains")
        return domain_config.suffix_to_ascii(value);
    if (kind == "subnets")
        return ip.nft_ip_or_cidr(value) ? value : null;

    return null;
}

function write_optional_lines(path, lines) {
    if (path == null || path == "")
        return;

    if (!write_text_file(path, length(lines) > 0 ? join("\n", lines) + "\n" : ""))
        exit(1);
}

function import_plain_list(plain_path, ruleset_path, key, kind, chunk_size_text, invalid_path, counts_path) {
    let data = fs.readfile(plain_path);
    if (data == null)
        exit(1);

    let chunk_size = int(chunk_size_text || 5000);
    if (chunk_size < 1)
        chunk_size = 5000;

    let chunk = [];
    let invalid = [];
    let counts = [];

    for (let line in split(as_string(data), "\n")) {
        line = trim_string(line);

        if (line == "")
            continue;

        let normalized = normalize_plain_ruleset_value(line, kind);
        if (normalized == null) {
            push(invalid, line);
            continue;
        }

        push(chunk, normalized);

        if (length(chunk) == chunk_size) {
            push(counts, "" + length(chunk));
            patch_source_values(ruleset_path, key, chunk);
            chunk = [];
        }
    }

    if (length(chunk) > 0) {
        push(counts, "" + length(chunk));
        patch_source_values(ruleset_path, key, chunk);
    }

    write_optional_lines(invalid_path, invalid);
    write_optional_lines(counts_path, counts);
}

function extract_ip_cidr(json_path, output_path) {
    let ruleset = object_or_empty(read_json_file(json_path));
    let lines = [];

    for (let rule in array_or_empty(ruleset.rules)) {
        if (type(rule) != "object")
            continue;
        for (let ip in array_or_empty(rule.ip_cidr))
            push(lines, as_string(ip));
    }

    if (!write_text_file(output_path, length(lines) > 0 ? join("\n", lines) + "\n" : ""))
        exit(1);
}

function parse_port_number(value) {
    let text = trim_string(value);
    if (text == "" || match(text, /[^0-9]/))
        return null;

    let number = int(text);
    if (number < 1 || number > 65535)
        return null;

    return number;
}

function parse_port_interval(value, allow_open) {
    let text = trim_string(value);
    if (text == "")
        return null;

    let separator = index(text, ":") >= 0 ? ":" : (index(text, "-") >= 0 ? "-" : "");
    if (separator == "") {
        let port = parse_port_number(text);
        return port == null ? null : { start: port, end: port };
    }

    let parts = split(text, separator);
    if (length(parts) != 2)
        return null;

    let start = parts[0] == "" && allow_open ? 1 : parse_port_number(parts[0]);
    let end = parts[1] == "" && allow_open ? 65535 : parse_port_number(parts[1]);

    if (start == null || end == null || start > end)
        return null;

    return { start, end };
}

function normalize_port_intervals(intervals) {
    let sorted = [];
    for (let interval in array_or_empty(intervals)) {
        if (type(interval) == "object" && interval.start != null && interval.end != null)
            push(sorted, { start: int(interval.start), end: int(interval.end) });
    }

    sort(sorted, function(first, second) {
        if (first.start == second.start)
            return first.end - second.end;
        return first.start - second.start;
    });

    let result = [];
    for (let interval in sorted) {
        if (length(result) == 0) {
            push(result, interval);
            continue;
        }

        let last = result[length(result) - 1];
        if (interval.start <= last.end + 1) {
            if (interval.end > last.end)
                last.end = interval.end;
        }
        else {
            push(result, interval);
        }
    }

    return result;
}

function direct_port_filter(rule) {
    if (type(rule) != "object")
        return null;

    let intervals = [];
    for (let port in array_from_value(rule.port)) {
        let interval = parse_port_interval(port, false);
        if (interval != null)
            push(intervals, interval);
    }

    for (let port_range in array_from_value(rule.port_range)) {
        let interval = parse_port_interval(port_range, true);
        if (interval != null)
            push(intervals, interval);
    }

    return length(intervals) == 0 ? null : normalize_port_intervals(intervals);
}

function filter_is_empty(filter) {
    return type(filter) == "array" && length(filter) == 0;
}

function intersect_port_filters(first, second) {
    if (first == null)
        return second;
    if (second == null)
        return first;
    if (filter_is_empty(first) || filter_is_empty(second))
        return [];

    let result = [];
    for (let left in first) {
        for (let right in second) {
            let start = left.start > right.start ? left.start : right.start;
            let end = left.end < right.end ? left.end : right.end;
            if (start <= end)
                push(result, { start, end });
        }
    }

    return normalize_port_intervals(result);
}

function union_port_filters(first, second) {
    if (first == null || second == null)
        return null;

    let result = [];
    for (let item in first)
        push(result, item);
    for (let item in second)
        push(result, item);

    return normalize_port_intervals(result);
}

function extract_port_filter(rule) {
    if (type(rule) != "object")
        return null;

    let own_filter = direct_port_filter(rule);
    if (rule.type != "logical" || type(rule.rules) != "array")
        return own_filter;

    let mode = as_string(rule.mode);
    if (mode == "or") {
        let result = null;
        let initialized = false;

        for (let child in rule.rules) {
            let child_filter = extract_port_filter(child);
            if (!initialized) {
                result = child_filter;
                initialized = true;
            }
            else {
                result = union_port_filters(result, child_filter);
            }

            if (result == null)
                break;
        }

        return intersect_port_filters(own_filter, result);
    }

    let result = own_filter;
    for (let child in rule.rules) {
        result = intersect_port_filters(result, extract_port_filter(child));
        if (filter_is_empty(result))
            return result;
    }

    return result;
}

function nft_port_value(interval) {
    return interval.start == interval.end ? "" + interval.start : interval.start + "-" + interval.end;
}

function add_line(lines, value) {
    if (value != "")
        lines[value] = true;
}

function add_ip_cidr_values_to_nft_outputs(rule, port_filter, unscoped_lines, scoped_lines) {
    for (let ip in array_from_value(rule.ip_cidr)) {
        ip = trim_string(ip);
        if (ip == "")
            continue;

        if (port_filter == null) {
            add_line(unscoped_lines, ip);
            continue;
        }

        if (filter_is_empty(port_filter))
            continue;

        for (let interval in port_filter)
            add_line(scoped_lines, ip + " . " + nft_port_value(interval));
    }
}

function collect_ip_cidr_nft_outputs(rule, inherited_filter, unscoped_lines, scoped_lines) {
    if (type(rule) != "object")
        return;

    let own_filter = direct_port_filter(rule);
    let filter = intersect_port_filters(inherited_filter, own_filter);

    if (filter_is_empty(filter))
        return;

    if (rule.type == "logical" && type(rule.rules) == "array") {
        if (as_string(rule.mode) == "and") {
            for (let child in rule.rules) {
                filter = intersect_port_filters(filter, extract_port_filter(child));
                if (filter_is_empty(filter))
                    return;
            }
        }

        add_ip_cidr_values_to_nft_outputs(rule, filter, unscoped_lines, scoped_lines);

        for (let child in rule.rules)
            collect_ip_cidr_nft_outputs(child, filter, unscoped_lines, scoped_lines);

        return;
    }

    add_ip_cidr_values_to_nft_outputs(rule, filter, unscoped_lines, scoped_lines);
}

function write_lines(path, lines_object) {
    let lines = keys(lines_object);
    sort(lines, function(first, second) {
        return first == second ? 0 : (first < second ? -1 : 1);
    });

    if (!write_text_file(path, length(lines) > 0 ? join("\n", lines) + "\n" : ""))
        exit(1);
}

function extract_ip_cidr_nft_elements(json_path, unscoped_output_path, scoped_output_path, ports_text, port_ranges_text) {
    let ruleset = object_or_empty(read_json_file(json_path));
    let unscoped_lines = {};
    let scoped_lines = {};
    let outer_filter = direct_port_filter({
        port: array_or_empty(json_decode_text(ports_text)),
        port_range: array_or_empty(json_decode_text(port_ranges_text))
    });

    for (let rule in array_or_empty(ruleset.rules))
        collect_ip_cidr_nft_outputs(rule, outer_filter, unscoped_lines, scoped_lines);

    write_lines(unscoped_output_path, unscoped_lines);
    write_lines(scoped_output_path, scoped_lines);
}

function value_has_domain_matchers(value) {
    if (type(value) == "array") {
        for (let item in value) {
            if (value_has_domain_matchers(item))
                return true;
        }
        return false;
    }

    if (type(value) != "object")
        return false;

    for (let key, item in value) {
        if (key == "domain" || key == "domain_suffix" || key == "domain_keyword" || key == "domain_regex") {
            if (type(item) == "array" && length(item) > 0)
                return true;
            if (type(item) == "string" && item != "")
                return true;
        }

        if (value_has_domain_matchers(item))
            return true;
    }

    return false;
}

function has_domain_matchers(path) {
    return value_has_domain_matchers(read_json_file(path));
}

function has_rules(path) {
    let ruleset = object_or_empty(read_json_file(path));
    return length(array_or_empty(ruleset.rules)) > 0;
}

function strip_utf8_bom(text) {
    text = as_string(text);
    if (length(text) >= 3 && ord(substr(text, 0, 1)) == 0xef && ord(substr(text, 1, 1)) == 0xbb && ord(substr(text, 2, 1)) == 0xbf)
        return substr(text, 3);
    return text;
}

function content_is_clash_rule_yaml(text) {
    text = replace(strip_utf8_bom(text), /\r/g, "");
    for (let raw_line in split(text, "\n")) {
        let trimmed = trim_string(raw_line);
        if (trimmed == "" || substr(trimmed, 0, 1) == "#")
            continue;
        if (match(trimmed, /^(---|\.\.\.)([ \t]+#.*)?$/) != null)
            continue;
        if (substr(raw_line, 0, 1) != " " && substr(raw_line, 0, 1) != "\t") {
            if (match(trimmed, /^(payload|rules)[ \t]*:([ \t]*(\[[ \t]*\])?[ \t]*(#.*)?)?$/) != null)
                return true;
        }
    }
    return false;
}

function unquote_yaml_scalar(raw) {
    let s = trim_string(raw);
    if (s == "")
        return "";

    let first = substr(s, 0, 1);
    if (first == "'") {
        let out = "";
        for (let i = 1; i < length(s); i++) {
            let ch = substr(s, i, 1);
            if (ch == "'") {
                if (i + 1 < length(s) && substr(s, i + 1, 1) == "'") {
                    out += "'";
                    i++;
                    continue;
                }
                return out;
            }
            out += ch;
        }
        return out;
    }

    if (first == "\"") {
        let out = "";
        for (let i = 1; i < length(s); i++) {
            let ch = substr(s, i, 1);
            if (ch == "\\" && i + 1 < length(s)) {
                let next = substr(s, i + 1, 1);
                if (next == "n")
                    out += "\n";
                else if (next == "t")
                    out += "\t";
                else
                    out += next;
                i++;
                continue;
            }
            if (ch == "\"")
                return out;
            out += ch;
        }
        return out;
    }

    for (let i = 1; i < length(s); i++) {
        if (substr(s, i, 1) == "#") {
            let prev = substr(s, i - 1, 1);
            if (prev == " " || prev == "\t") {
                s = substr(s, 0, i);
                break;
            }
        }
    }
    return trim_string(s);
}

function normalize_clash_ip_cidr(value) {
    value = trim_string(value);
    if (value == "")
        return null;
    if (ip.valid_ipv4_cidr(value, false) || ip.valid_ipv6_cidr(value))
        return value;
    if (ip.valid_ipv4(value, false, false))
        return value + "/32";
    if (ip.valid_ipv6(value))
        return value + "/128";
    return null;
}

function wildcard_domain_to_regex(value) {
    value = trim_string(value);
    if (value == "" || index(value, "*") < 0 || index(value, ".") < 0)
        return null;
    if (substr(value, 0, 1) == "." || substr(value, length(value) - 1, 1) == ".")
        return null;

    let labels = split(value, ".");
    if (length(labels) < 2)
        return null;

    let regex_labels = [];
    for (let label in labels) {
        if (label == "")
            return null;
        if (label == "*") {
            push(regex_labels, "[^.]+");
            continue;
        }
        if (index(label, "*") >= 0)
            return null;
        let normalized = domain_config.label_to_ascii(label);
        if (normalized == null)
            return null;
        push(regex_labels, normalized);
    }

    return "^" + join("\\.", regex_labels) + "$";
}

function normalize_exact_domain(value) {
    value = trim_string(value);
    if (value == "" || substr(value, 0, 1) == "." || ip.valid_ip_or_cidr(value))
        return null;
    return domain_config.suffix_to_ascii(value);
}

function parse_clash_rule_entries(text, domains_only) {
    let skip_ips = (domains_only === true || domains_only == "1" || domains_only == "true");
    let domains = [];
    let suffixes = [];
    let keywords = [];
    let regexes = [];
    let cidrs = [];
    let skipped_count = 0;

    let in_list = false;
    text = replace(strip_utf8_bom(text), /\r/g, "");

    for (let raw_line in split(text, "\n")) {
        let trimmed = trim_string(raw_line);
        if (trimmed == "" || substr(trimmed, 0, 1) == "#")
            continue;
        if (match(trimmed, /^(---|\.\.\.)([ \t]+#.*)?$/) != null)
            continue;

        let is_top_level = substr(raw_line, 0, 1) != " " && substr(raw_line, 0, 1) != "\t" && substr(trimmed, 0, 1) != "-";
        if (is_top_level) {
            in_list = match(trimmed, /^(payload|rules)[ \t]*:([ \t]*(\[[ \t]*\])?[ \t]*(#.*)?)?$/) != null;
            continue;
        }

        if (!in_list)
            continue;

        let item_match = match(trimmed, /^-[ \t]+(.*)$/);
        if (item_match == null)
            continue;

        let entry = unquote_yaml_scalar(item_match[1]);
        if (entry == "")
            continue;

        if (index(entry, ",") >= 0) {
            let parts = split(entry, ",");
            let kind = uc(trim_string(parts[0]));
            let target = length(parts) >= 2 ? trim_string(parts[1]) : "";

            if (kind == "DOMAIN") {
                let norm = normalize_exact_domain(target);
                if (norm != null)
                    push(domains, norm);
                else
                    skipped_count++;
            }
            else if (kind == "DOMAIN-SUFFIX") {
                if (substr(target, 0, 1) == ".")
                    target = substr(target, 1);
                let norm = normalize_exact_domain(target);
                if (norm != null)
                    push(suffixes, norm);
                else
                    skipped_count++;
            }
            else if (kind == "DOMAIN-KEYWORD") {
                let norm = domain_config.keyword_to_ascii(target);
                if (norm != null && norm != "")
                    push(keywords, norm);
                else
                    skipped_count++;
            }
            else if (kind == "DOMAIN-REGEX") {
                let norm = domain_config.regex_to_ascii(target);
                if (norm != null && norm != "")
                    push(regexes, norm);
                else
                    skipped_count++;
            }
            else if (kind == "IP-CIDR" || kind == "IP-CIDR6") {
                let cidr = normalize_clash_ip_cidr(target);
                if (cidr != null) {
                    if (!skip_ips)
                        push(cidrs, cidr);
                }
                else {
                    skipped_count++;
                }
            }
            else {
                // Safely skip PROCESS-NAME, DST-PORT, GEOIP, MATCH, etc.
                skipped_count++;
            }
            continue;
        }

        // Non-comma entry: Clash `ipcidr` or `domain` behavior
        let cidr = normalize_clash_ip_cidr(entry);
        if (cidr != null) {
            if (!skip_ips)
                push(cidrs, cidr);
            continue;
        }

        if (substr(entry, 0, 2) == "+.") {
            let norm = normalize_exact_domain(substr(entry, 2));
            if (norm != null)
                push(suffixes, norm);
            else
                skipped_count++;
            continue;
        }

        if (substr(entry, 0, 1) == ".") {
            let norm = domain_config.suffix_to_ascii(entry);
            if (norm != null)
                push(suffixes, norm);
            else
                skipped_count++;
            continue;
        }

        if (index(entry, "*") >= 0) {
            let rx = wildcard_domain_to_regex(entry);
            if (rx != null)
                push(regexes, rx);
            else
                skipped_count++;
            continue;
        }

        let exact = normalize_exact_domain(entry);
        if (exact != null)
            push(domains, exact);
        else
            skipped_count++;
    }

    return {
        domain: unique_values(domains),
        domain_suffix: unique_values(suffixes),
        domain_keyword: unique_values(keywords),
        domain_regex: unique_values(regexes),
        ip_cidr: skip_ips ? [] : unique_values(cidrs),
        skipped_count
    };
}

function import_clash_yaml(yaml_path, ruleset_path, subnets_lst_path, domains_only) {
    let data = fs.readfile(as_string(yaml_path));
    if (data == null || !content_is_clash_rule_yaml(data))
        return false;

    let skip_ips = (domains_only === true || domains_only == "1" || domains_only == "true");
    let parsed = parse_clash_rule_entries(data, skip_ips);

    if (fs.stat(as_string(ruleset_path)) == null) {
        if (!write_json_file(ruleset_path, { version: 3, rules: [] }))
            return false;
    }

    if (length(parsed.domain) > 0)
        patch_source_values(ruleset_path, "domain", parsed.domain);
    if (length(parsed.domain_suffix) > 0)
        patch_source_values(ruleset_path, "domain_suffix", parsed.domain_suffix);
    if (length(parsed.domain_keyword) > 0)
        patch_source_values(ruleset_path, "domain_keyword", parsed.domain_keyword);
    if (length(parsed.domain_regex) > 0)
        patch_source_values(ruleset_path, "domain_regex", parsed.domain_regex);
    if (!skip_ips && length(parsed.ip_cidr) > 0)
        patch_source_values(ruleset_path, "ip_cidr", parsed.ip_cidr);

    subnets_lst_path = as_string(subnets_lst_path || "");
    if (subnets_lst_path != "") {
        let combined = [];
        let existing_text = fs.readfile(subnets_lst_path);
        if (existing_text != null && existing_text != "") {
            for (let line in split(replace(as_string(existing_text), /\r/g, ""), "\n")) {
                line = trim_string(line);
                if (line != "")
                    push(combined, line);
            }
        }
        if (!skip_ips) {
            for (let cidr in parsed.ip_cidr)
                push(combined, cidr);
        }
        combined = unique_values(combined);
        if (!write_text_file(subnets_lst_path, length(combined) > 0 ? join("\n", combined) + "\n" : ""))
            return false;
    }

    return true;
}

function module_exports() {
    return {
        create_source,
        patch_source,
        patch_source_values,
        import_plain_list,
        content_is_clash_rule_yaml,
        parse_clash_rule_entries,
        import_clash_yaml,
        extract_ip_cidr,
        extract_ip_cidr_nft_elements,
        has_domain_matchers,
        has_rules,
        ruleset_tag,
        read_json_file,
        write_json_file
    };
}

if ((sourcepath(1) != null && sourcepath(1) != "") || SCRIPT_NAME != sourcepath(0))
    return module_exports();

let mode = ARGV[0] || "";

if (mode == "create-source")
    create_source(ARGV[1]);
else if (mode == "tag")
    print(ruleset_tag(ARGV[1], ARGV[2], ARGV[3]), "\n");
else if (mode == "patch-source")
    patch_source(ARGV[1], ARGV[2], ARGV[3]);
else if (mode == "import-plain-list")
    import_plain_list(ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5], ARGV[6], ARGV[7]);
else if (mode == "import-clash-yaml") {
    if (!import_clash_yaml(ARGV[1], ARGV[2], ARGV[3] || "", ARGV[4]))
        exit(1);
}
else if (mode == "extract-ip-cidr")
    extract_ip_cidr(ARGV[1], ARGV[2]);
else if (mode == "extract-ip-cidr-nft")
    extract_ip_cidr_nft_elements(ARGV[1], ARGV[2], ARGV[3], ARGV[4] || "[]", ARGV[5] || "[]");
else if (mode == "has-domain-matchers")
    exit(has_domain_matchers(ARGV[1]) ? 0 : 1);
else if (mode == "has-rules")
    exit(has_rules(ARGV[1]) ? 0 : 1);
else {
    warn("Usage: routing/rulesets.uc <create-source|tag|patch-source|import-plain-list|import-clash-yaml|extract-ip-cidr|extract-ip-cidr-nft|has-domain-matchers|has-rules> ...\n");
    exit(1);
}
