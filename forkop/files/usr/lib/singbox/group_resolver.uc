/* Pure shared membership authority. Accessors must use an installed snapshot. */
let common = require("core.common");
let runtime_urltest = require("singbox.urltest");
let runtime_constants = require("singbox.constants");
let as_string = common.as_string;
let array_or_empty = common.array_or_empty;
let object_or_empty = common.object_or_empty;
function create(connections) {
let trace_sink = null;
function set_trace(sink) { trace_sink = sink; }
function supported_urltest_filter_mode(mode) {
    return mode == "include" || mode == "exclude" || mode == "mixed";
}

function filter_mode_uses_include(mode) {
    return mode == "include" || mode == "mixed";
}

function filter_mode_uses_exclude(mode) {
    return mode == "exclude" || mode == "mixed";
}

function configured_country_filter(mode, include_countries, exclude_countries) {
    return (filter_mode_uses_include(mode) && length(array_or_empty(include_countries)) > 0) ||
        (filter_mode_uses_exclude(mode) && length(array_or_empty(exclude_countries)) > 0);
}

function urltest_country_metadata(section, urltest_id, state) {
    let metadata = object_or_empty(object_or_empty(state.outboundMetadata).countries);
    let detect_method = connections.urltest_detect_server_country(section, urltest_id);
    if (detect_method == "flag_emoji")
        return runtime_urltest.countries_from_flag_names(object_or_empty(object_or_empty(state.outboundMetadata).names));
    return metadata;
}

function array_contains(values, needle) {
    for (let value in array_or_empty(values)) {
        if (value == needle)
            return true;
    }
    return false;
}

function unique_string_array(values) {
    let result = [];
    let seen = {};
    for (let value in array_or_empty(values)) {
        value = as_string(value);
        if (value == "" || seen[value])
            continue;
        seen[value] = true;
        push(result, value);
    }
    return result;
}

function object_keys_set(values) {
    let result = {};
    for (let value in array_or_empty(values))
        result[value] = true;
    return result;
}

function tag_display_name(tag, names) {
    let name = as_string(object_or_empty(names)[tag] || "");
    return name != "" ? name : tag;
}

function regex_match_set(tags, names, regexes) {
    return object_keys_set(runtime_urltest.regex_matching_tag_array(tags, names, regexes));
}

function tag_name_filter_matches(tag, names, name_filter, regex_set) {
    let name = tag_display_name(tag, names);
    return array_contains(name_filter, name) || regex_set[tag];
}

function tag_country_filter_matches(tag, countries, country_filter) {
    let country = uc(as_string(object_or_empty(countries)[tag] || ""));
    return country != "" && array_contains(country_filter, country);
}

function tag_attribute_filter_matches(tag, metadata, selected_values) {
    selected_values = array_or_empty(selected_values);
    if (length(selected_values) == 0)
        return true;

    let value = lc(as_string(object_or_empty(metadata)[tag] || ""));
    if (value == "")
        return false;
    for (let selected in selected_values)
        if (lc(as_string(selected)) == value)
            return true;
    return false;
}

function proxy_parameter_filter_matches_all(tag, metadata, protocols, transports, securities) {
    metadata = object_or_empty(metadata);
    return tag_attribute_filter_matches(tag, metadata.protocols, protocols) &&
        tag_attribute_filter_matches(tag, metadata.transports, transports) &&
        tag_attribute_filter_matches(tag, metadata.securities, securities);
}

function proxy_parameter_filter_matches_any(tag, metadata, protocols, transports, securities) {
    metadata = object_or_empty(metadata);
    return (length(array_or_empty(protocols)) > 0 &&
            tag_attribute_filter_matches(tag, metadata.protocols, protocols)) ||
        (length(array_or_empty(transports)) > 0 &&
            tag_attribute_filter_matches(tag, metadata.transports, transports)) ||
        (length(array_or_empty(securities)) > 0 &&
            tag_attribute_filter_matches(tag, metadata.securities, securities));
}

function name_or_country_filter_configured(name_filter, regexes, country_filter) {
    return length(array_or_empty(name_filter)) > 0 ||
        length(array_or_empty(regexes)) > 0 ||
        length(array_or_empty(country_filter)) > 0;
}

function urltest_all_candidate_outbounds(urltest_candidate_tags) {
    return unique_string_array(urltest_candidate_tags);
}

function urltest_matching_candidate_outbounds(urltest_candidate_tags, names, countries, name_filter, regexes, country_filter,
    metadata, proxy_parameters_enabled, proxy_parameters_operator, protocols, transports, securities, additional_matches) {
    names = object_or_empty(names);
    countries = object_or_empty(countries);
    country_filter = runtime_urltest.normalized_country_list(country_filter);

    let regex_set = regex_match_set(urltest_candidate_tags, names, regexes);
    let base_filter_configured = name_or_country_filter_configured(name_filter, regexes, country_filter);
    let additional_set = object_keys_set(additional_matches);
    let result = [];

    for (let tag in array_or_empty(urltest_candidate_tags)) {
        let base_matches = tag_name_filter_matches(tag, names, name_filter, regex_set) ||
            tag_country_filter_matches(tag, countries, country_filter);
        let matches = additional_set[tag] || base_matches;
        if (proxy_parameters_enabled && proxy_parameters_operator == "or") {
            matches = additional_set[tag] || base_matches || proxy_parameter_filter_matches_any(
                tag, metadata, protocols, transports, securities
            );
        }
        else if (proxy_parameters_enabled) {
            if (!base_filter_configured)
                base_matches = true;
            matches = additional_set[tag] ||
                (base_matches && proxy_parameter_filter_matches_all(
                    tag, metadata, protocols, transports, securities
                ));
        }

        if (matches)
            push(result, tag);
    }

    return unique_string_array(result);
}

function urltest_exclude_outbounds(all_outbounds, excluded_outbounds) {
    let excluded = object_keys_set(excluded_outbounds);
    let result = [];
    for (let tag in array_or_empty(all_outbounds)) {
        if (!excluded[tag])
            push(result, tag);
    }
    return result;
}

function filter_candidate_outbounds(filter_mode, urltest_candidate_tags, names, countries, metadata,
    include_names, include_regex, include_countries,
    include_proxy_parameters, include_protocols, include_transports, include_securities,
    exclude_names, exclude_regex, exclude_countries,
    exclude_proxy_parameters, exclude_protocols, exclude_transports, exclude_securities,
    include_additional_matches, exclude_additional_matches) {
    let all_outbounds = urltest_all_candidate_outbounds(urltest_candidate_tags);
    if (filter_mode == "" || filter_mode == "disabled") {
        if (trace_sink) for (let tag in all_outbounds) trace_sink(tag, true, "all_candidates");
        return all_outbounds;
    }
    if (!supported_urltest_filter_mode(filter_mode))
        return all_outbounds;

    let include_outbounds = urltest_matching_candidate_outbounds(
        urltest_candidate_tags,
        names,
        countries,
        include_names,
        include_regex,
        include_countries,
        metadata,
        include_proxy_parameters,
        "and",
        include_protocols,
        include_transports,
        include_securities,
        include_additional_matches
    );
    let exclude_outbounds = urltest_matching_candidate_outbounds(
        urltest_candidate_tags,
        names,
        countries,
        exclude_names,
        exclude_regex,
        exclude_countries,
        metadata,
        exclude_proxy_parameters,
        "or",
        exclude_protocols,
        exclude_transports,
        exclude_securities,
        exclude_additional_matches
    );

    if (trace_sink) for (let tag in all_outbounds) {
        let inc = !filter_mode_uses_include(filter_mode) || array_contains(include_outbounds, tag);
        let exc = filter_mode_uses_exclude(filter_mode) && array_contains(exclude_outbounds, tag);
        trace_sink(tag, inc && !exc, exc ? "exclude_match" : inc ? "include_match" : "include_miss");
    }

    if (filter_mode == "include")
        return include_outbounds;
    if (filter_mode == "exclude")
        return urltest_exclude_outbounds(all_outbounds, exclude_outbounds);
    if (filter_mode == "mixed")
        return urltest_exclude_outbounds(include_outbounds, exclude_outbounds);
    return all_outbounds;
}

function urltest_filtered_outbounds(section, urltest_id, urltest_candidate_tags, state) {
    return filter_candidate_outbounds(
        connections.urltest_filter_mode(section, urltest_id),
        urltest_candidate_tags,
        object_or_empty(object_or_empty(state.outboundMetadata).names),
        urltest_country_metadata(section, urltest_id, state),
        object_or_empty(state.outboundMetadata),
        connections.urltest_include_outbounds(section, urltest_id),
        connections.urltest_include_regex(section, urltest_id),
        connections.urltest_include_countries(section, urltest_id),
        connections.urltest_include_proxy_parameters(section, urltest_id),
        connections.urltest_include_protocols(section, urltest_id),
        connections.urltest_include_transports(section, urltest_id),
        connections.urltest_include_securities(section, urltest_id),
        connections.urltest_exclude_outbounds(section, urltest_id),
        connections.urltest_exclude_regex(section, urltest_id),
        connections.urltest_exclude_countries(section, urltest_id),
        connections.urltest_exclude_proxy_parameters(section, urltest_id),
        connections.urltest_exclude_protocols(section, urltest_id),
        connections.urltest_exclude_transports(section, urltest_id),
        connections.urltest_exclude_securities(section, urltest_id)
    );
}

function priority_level_country_metadata(group_id, level_id, state) {
    let metadata = object_or_empty(object_or_empty(state.outboundMetadata).countries);
    let detect_method = connections.priority_level_detect_server_country(group_id, level_id);
    if (detect_method == "flag_emoji")
        return runtime_urltest.countries_from_flag_names(object_or_empty(object_or_empty(state.outboundMetadata).names));
    return metadata;
}

function priority_level_filtered_outbounds(group_id, level_id, urltest_candidate_tags, state) {
    if (connections.priority_level_direct(group_id, level_id))
        return [ runtime_constants.DIRECT_OUTBOUND_TAG ];

    return filter_candidate_outbounds(
        connections.priority_level_filter_mode(group_id, level_id),
        urltest_candidate_tags,
        object_or_empty(object_or_empty(state.outboundMetadata).names),
        priority_level_country_metadata(group_id, level_id, state),
        object_or_empty(state.outboundMetadata),
        connections.priority_level_include_outbounds(group_id, level_id),
        connections.priority_level_include_regex(group_id, level_id),
        connections.priority_level_include_countries(group_id, level_id),
        connections.priority_level_include_proxy_parameters(group_id, level_id),
        connections.priority_level_include_protocols(group_id, level_id),
        connections.priority_level_include_transports(group_id, level_id),
        connections.priority_level_include_securities(group_id, level_id),
        connections.priority_level_exclude_outbounds(group_id, level_id),
        connections.priority_level_exclude_regex(group_id, level_id),
        connections.priority_level_exclude_countries(group_id, level_id),
        connections.priority_level_exclude_proxy_parameters(group_id, level_id),
        connections.priority_level_exclude_protocols(group_id, level_id),
        connections.priority_level_exclude_transports(group_id, level_id),
        connections.priority_level_exclude_securities(group_id, level_id)
    );
}

function dashboard_country_metadata(section, state) {
    let metadata = object_or_empty(object_or_empty(state.outboundMetadata).countries);
    if (connections.dashboard_detect_server_country(section) == "flag_emoji")
        return runtime_urltest.countries_from_flag_names(object_or_empty(object_or_empty(state.outboundMetadata).names));
    return metadata;
}

function selected_group_outbounds(group_names, group_outbounds) {
    group_outbounds = object_or_empty(group_outbounds);
    let result = [];
    for (let group_name in array_or_empty(group_names))
        for (let tag_name in array_or_empty(group_outbounds[group_name]))
            push(result, tag_name);
    return unique_string_array(result);
}

function remember_dashboard_group_outbounds(group_outbounds, group_name, outbounds) {
    group_name = as_string(group_name);
    if (group_name == "")
        return;

    let combined = array_or_empty(group_outbounds[group_name]);
    for (let tag_name in array_or_empty(outbounds))
        push(combined, tag_name);
    group_outbounds[group_name] = unique_string_array(combined);
}

function dashboard_filtered_outbounds(section, selector_tags, state, group_outbounds) {
    return filter_candidate_outbounds(
        connections.dashboard_filter_mode(section),
        selector_tags,
        object_or_empty(object_or_empty(state.outboundMetadata).names),
        dashboard_country_metadata(section, state),
        object_or_empty(state.outboundMetadata),
        connections.dashboard_include_outbounds(section),
        connections.dashboard_include_regex(section),
        connections.dashboard_include_countries(section),
        connections.dashboard_include_proxy_parameters(section),
        connections.dashboard_include_protocols(section),
        connections.dashboard_include_transports(section),
        connections.dashboard_include_securities(section),
        connections.dashboard_exclude_outbounds(section),
        connections.dashboard_exclude_regex(section),
        connections.dashboard_exclude_countries(section),
        connections.dashboard_exclude_proxy_parameters(section),
        connections.dashboard_exclude_protocols(section),
        connections.dashboard_exclude_transports(section),
        connections.dashboard_exclude_securities(section),
        selected_group_outbounds(connections.dashboard_include_groups(section), group_outbounds),
        selected_group_outbounds(connections.dashboard_exclude_groups(section), group_outbounds)
    );
}

function section_pool_candidate_outbounds(section, urltest_candidate_tags, state) {
    if (!filter_mode_uses_exclude(connections.dashboard_filter_mode(section)))
        return urltest_candidate_tags;

    return filter_candidate_outbounds(
        "exclude",
        urltest_candidate_tags,
        object_or_empty(object_or_empty(state.outboundMetadata).names),
        dashboard_country_metadata(section, state),
        object_or_empty(state.outboundMetadata),
        // include side is unused in "exclude" mode
        [], [], [], false, [], [], [],
        connections.dashboard_exclude_outbounds(section),
        connections.dashboard_exclude_regex(section),
        connections.dashboard_exclude_countries(section),
        connections.dashboard_exclude_proxy_parameters(section),
        connections.dashboard_exclude_protocols(section),
        connections.dashboard_exclude_transports(section),
        connections.dashboard_exclude_securities(section)
    );
}

function priority_levels_with_outbounds(group_id, urltest_candidate_tags, state) {
    let result = [];
    let assigned = {};

    for (let level_id in connections.priority_levels(group_id)) {
        let outbounds = [];
        for (let tag_name in priority_level_filtered_outbounds(group_id, level_id, urltest_candidate_tags, state)) {
            if (!assigned[tag_name]) {
                assigned[tag_name] = true;
                push(outbounds, tag_name);
            }
        }

        push(result, {
            id: level_id,
            displayName: connections.priority_level_display_name(group_id, level_id),
            order: int(connections.priority_level_order(group_id, level_id), 10),
            direct: connections.priority_level_direct(group_id, level_id),
            filter_mode: connections.priority_level_filter_mode(group_id, level_id),
            detect_server_country: connections.priority_level_detect_server_country(group_id, level_id),
            outbounds
        });
    }

    return result;
}

function priority_group_outbounds(levels) {
    let result = [];
    let seen = {};
    for (let level in array_or_empty(levels)) {
        for (let tag_name in array_or_empty(level.outbounds)) {
            tag_name = as_string(tag_name);
            if (tag_name != "" && !seen[tag_name]) {
                seen[tag_name] = true;
                push(result, tag_name);
            }
        }
    }
    return result;
}


return { supported_urltest_filter_mode, filter_mode_uses_include, filter_mode_uses_exclude, configured_country_filter, urltest_country_metadata, array_contains, unique_string_array, object_keys_set, tag_display_name, regex_match_set, tag_name_filter_matches, tag_country_filter_matches, tag_attribute_filter_matches, proxy_parameter_filter_matches_all, proxy_parameter_filter_matches_any, name_or_country_filter_configured, urltest_all_candidate_outbounds, urltest_matching_candidate_outbounds, urltest_exclude_outbounds, filter_candidate_outbounds, urltest_filtered_outbounds, priority_level_country_metadata, priority_level_filtered_outbounds, dashboard_country_metadata, selected_group_outbounds, remember_dashboard_group_outbounds, dashboard_filtered_outbounds, section_pool_candidate_outbounds, priority_levels_with_outbounds, priority_group_outbounds, set_trace };
}
return { create };
