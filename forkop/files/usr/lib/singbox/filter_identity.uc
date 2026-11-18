// Canonical connection identity, volatile label normalization, and alias history.
// GPL-2.0-or-later, see repository LICENSE.
let common = require("core.common");
let sha256 = require("core.sha256");

let as_string = common.as_string;
let array_or_empty = common.array_or_empty;

const NON_CONNECTION_TYPES = {
    selector: true,
    urltest: true,
    direct: true,
    dns: true,
    block: true
};

const VOLATILE_WRAPPER_KEYS = {
    tag: true,
    remark: true,
    share_link: true,
    detour: true,
    domain_resolver: true,
    routing_mark: true,
    bind_interface: true,
    inet4_bind_address: true,
    inet6_bind_address: true
};

const DECORATIVE_EMOJIS = {
    "0x1f7e2": true, // 🟢
    "0x1f7e1": true, // 🟡
    "0x1f534": true, // 🔴
    "0x1f7e0": true, // 🟠
    "0x1f535": true, // 🔵
    "0x1f7e3": true, // 🟣
    "0x1f7e4": true, // 🟤
    "0x26ab": true,  // ⚫
    "0x26aa": true,  // ⚪
    "0x26a1": true,  // ⚡
    "0x1f525": true, // 🔥
    "0x2b50": true,  // ⭐
    "0x1f31f": true, // 🌟
    "0x1f680": true, // 🚀
    "0x1f48e": true, // 💎
    "0x2728": true,  // ✨
    "0x1f310": true, // 🌐
    "0x1f6e1": true, // 🛡️
    "0x23f3": true,  // ⏳
    "0x231b": true,  // ⌛
    "0x2705": true,  // ✅
    "0x274c": true,  // ❌
    "0x26a0": true,  // ⚠️
    "0x1f512": true, // 🔒
    "0x1f3c6": true, // 🏆
    "0x1f451": true, // 👑
    "0x1f4f6": true  // 📶
};

function canonical_json(value, is_root) {
    let kind = type(value);
    if (kind == "object") {
        let filtered = [];
        for (let key in keys(value)) {
            if (value[key] == null)
                continue;
            if (substr(key, 0, 9) == "__forkop_")
                continue;
            if (is_root && VOLATILE_WRAPPER_KEYS[key])
                continue;
            push(filtered, key);
        }
        sort(filtered);
        let parts = [];
        for (let key in filtered)
            push(parts, sprintf("%J", key) + ":" + canonical_json(value[key], false));
        return "{" + join(",", parts) + "}";
    }
    if (kind == "array") {
        let parts = [];
        for (let item in value)
            push(parts, canonical_json(item, false));
        return "[" + join(",", parts) + "]";
    }
    return sprintf("%J", value);
}

function connection_id(entry) {
    if (type(entry) != "object" || entry == null)
        return "";

    let entry_type = lc(trim(as_string(entry.type || "")));
    if (entry_type == "" || NON_CONNECTION_TYPES[entry_type])
        return "";

    let serialized = canonical_json(entry, true);
    return "cid1:" + substr(sha256.digest(serialized), 0, 24);
}

function utf8_step(text, offset) {
    let len = length(text);
    let b1 = ord(substr(text, offset, 1));
    if (b1 < 0x80)
        return { cp: b1, raw: substr(text, offset, 1), next: offset + 1 };

    if (b1 >= 0xc2 && b1 <= 0xdf && offset + 1 < len) {
        let b2 = ord(substr(text, offset + 1, 1));
        if ((b2 & 0xc0) == 0x80) {
            return {
                cp: ((b1 & 0x1f) << 6) | (b2 & 0x3f),
                raw: substr(text, offset, 2),
                next: offset + 2
            };
        }
    }

    if (b1 >= 0xe0 && b1 <= 0xef && offset + 2 < len) {
        let b2 = ord(substr(text, offset + 1, 1));
        let b3 = ord(substr(text, offset + 2, 1));
        if ((b2 & 0xc0) == 0x80 && (b3 & 0xc0) == 0x80) {
            return {
                cp: ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f),
                raw: substr(text, offset, 3),
                next: offset + 3
            };
        }
    }

    if (b1 >= 0xf0 && b1 <= 0xf4 && offset + 3 < len) {
        let b2 = ord(substr(text, offset + 1, 1));
        let b3 = ord(substr(text, offset + 2, 1));
        let b4 = ord(substr(text, offset + 3, 1));
        if ((b2 & 0xc0) == 0x80 && (b3 & 0xc0) == 0x80 && (b4 & 0xc0) == 0x80) {
            return {
                cp: ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f),
                raw: substr(text, offset, 4),
                next: offset + 4
            };
        }
    }

    return { cp: b1, raw: substr(text, offset, 1), next: offset + 1 };
}

function utf8_tokens(text) {
    let tokens = [];
    for (let i = 0; i < length(text); ) {
        let step = utf8_step(text, i);
        push(tokens, step);
        i = step.next;
    }
    return tokens;
}

function is_regional_indicator(cp) {
    return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

function is_decorative_emoji(cp) {
    return DECORATIVE_EMOJIS[sprintf("0x%x", cp)] == true;
}

function is_separator_cp(cp) {
    return cp == 0x20 || cp == 0x09 || cp == 0x0a || cp == 0x0d ||
        cp == 0x7c || // |
        cp == 0x2d || // -
        cp == 0x3a || // :
        cp == 0x5f || // _
        cp == 0x2022 || // •
        cp == 0x00b7 || // ·
        cp == 0x2013 || // –
        cp == 0x2014;   // —
}

function strip_emojis_and_flags(text) {
    let tokens = utf8_tokens(text);
    let out = "";

    for (let idx = 0; idx < length(tokens); idx++) {
        let cp = tokens[idx].cp;

        if (is_regional_indicator(cp)) {
            if (idx + 1 < length(tokens) && is_regional_indicator(tokens[idx + 1].cp))
                idx++;
            out += " ";
            continue;
        }

        if (cp == 0x1f3f4) {
            while (idx + 1 < length(tokens) && tokens[idx + 1].cp >= 0xe0020 && tokens[idx + 1].cp <= 0xe007f)
                idx++;
            out += " ";
            continue;
        }

        if (cp == 0xfe0e || cp == 0xfe0f || cp == 0x200d)
            continue;

        if (is_decorative_emoji(cp)) {
            out += " ";
            continue;
        }

        out += tokens[idx].raw;
    }

    return out;
}

function trim_separators(text) {
    let tokens = utf8_tokens(as_string(text));
    let start = 0;
    let end = length(tokens);

    while (start < end && is_separator_cp(tokens[start].cp))
        start++;
    while (end > start && is_separator_cp(tokens[end - 1].cp))
        end--;

    let out = "";
    for (let i = start; i < end; i++)
        out += tokens[i].raw;
    return out;
}

function normalize_counter_symbols(text) {
    let tokens = utf8_tokens(as_string(text));
    let out = "";
    for (let tok in tokens) {
        if (tok.cp == 0x2191 || tok.cp == 0x2193 || tok.cp == 0x21c5) // ↑ ↓ ⇅
            continue;
        if (tok.cp == 0x221e) { // ∞
            out += "inf";
            continue;
        }
        out += tok.raw;
    }
    return out;
}

function is_volatile_bracket_body(inner) {
    inner = trim(normalize_counter_symbols(inner));
    if (inner == "")
        return true;

    let lower = lc(inner);

    // Byte traffic counters: "12.3 GiB / 100 GB", "45.2 GB", "rem: 9.1 MB", etc.
    if (match(lower, /^(used|rem|remaining|traffic|[ \t:])*[0-9]+([.,][0-9]+)?[ \t]*(b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)([ \t]*\/[ \t]*([0-9]+([.,][0-9]+)?[ \t]*(b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)|unlimited|inf))?[ \t]*$/) != null)
        return true;

    // Expiry / remaining time: "14d left", "30 days", "12d 5h left", "exp: 2026-12-31", "2026-12-31"
    if (match(lower, /^[0-9]+[ \t]*(d|day|days|h|hr|hrs|hour|hours|w|wk|wks)([ \t]+[0-9]+[ \t]*(h|hr|hrs|m|min|mins))?([ \t]+(left|rem|remaining))?$/) != null)
        return true;
    if (match(lower, /^(exp|expires|left|rem|remaining)[: \t].+$/) != null)
        return true;
    if (match(lower, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) != null)
        return true;

    return false;
}

function strip_unbracketed_trailing_counter(text) {
    // Check if entire string is just a traffic counter
    let lower_full = lc(normalize_counter_symbols(text));
    if (match(lower_full, /^[0-9]+([.,][0-9]+)?[ \t]*(kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)([ \t]*\/[ \t]*([0-9]+([.,][0-9]+)?[ \t]*(b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)|unlimited|inf))?$/) != null)
        return "";

    // Scan from left to right for the rightmost separator/space where the remainder is a traffic/expiry counter
    let tokens = utf8_tokens(text);
    for (let i = length(tokens) - 1; i >= 0; i--) {
        if (!is_separator_cp(tokens[i].cp))
            continue;

        let tail = "";
        for (let j = i + 1; j < length(tokens); j++)
            tail += tokens[j].raw;
        tail = trim(normalize_counter_symbols(tail));
        if (tail == "")
            continue;

        let lower_tail = lc(tail);
        let is_traffic = match(lower_tail, /^[0-9]+([.,][0-9]+)?[ \t]*(kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)([ \t]*\/[ \t]*([0-9]+([.,][0-9]+)?[ \t]*(b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib)|unlimited|inf))?$/) != null;
        let is_expiry = match(lower_tail, /^[0-9]+[ \t]*(d|day|days|h|hr|hrs|hour|hours)[ \t]+(left|remaining)$/) != null;

        if (is_traffic || is_expiry) {
            let head = "";
            for (let k = 0; k < i; k++)
                head += tokens[k].raw;
            return head;
        }
    }

    return text;
}

function last_char_index(text, ch) {
    for (let i = length(text) - 1; i >= 0; i--) {
        if (substr(text, i, 1) == ch)
            return i;
    }
    return -1;
}

function strip_trailing_volatile_counters(text) {
    while (true) {
        text = trim_separators(text);
        if (text == "")
            break;

        let last_ch = substr(text, length(text) - 1, 1);
        if (last_ch == ")" || last_ch == "]") {
            let open_ch = last_ch == ")" ? "(" : "[";
            let open_idx = last_char_index(text, open_ch);
            if (open_idx >= 0) {
                let inner = substr(text, open_idx + 1, length(text) - open_idx - 2);
                if (is_volatile_bracket_body(inner)) {
                    text = substr(text, 0, open_idx);
                    continue;
                }
            }
        }

        let stripped = strip_unbracketed_trailing_counter(text);
        if (stripped != text) {
            text = stripped;
            continue;
        }

        break;
    }

    return trim_separators(text);
}

function has_alnum_or_cyrillic_stem(text) {
    for (let tok in utf8_tokens(text)) {
        let cp = tok.cp;
        if ((cp >= 0x30 && cp <= 0x39) ||
            (cp >= 0x41 && cp <= 0x5a) ||
            (cp >= 0x61 && cp <= 0x7a) ||
            (cp >= 0x0400 && cp <= 0x04ff))
            return true;
    }
    return false;
}

function canonical_label(label) {
    let text = strip_emojis_and_flags(as_string(label));
    text = replace(text, /[ \t\r\n]+/g, " ");
    text = strip_trailing_volatile_counters(text);
    text = replace(text, /[ \t\r\n]+/g, " ");
    text = trim_separators(text);

    if (!has_alnum_or_cyrillic_stem(text))
        return "";

    return text;
}

function merge_alias_history(previous_names, previous_display_name, new_display_name, max_len) {
    let limit = max_len == null ? 16 : int(max_len, 10);
    if (limit <= 0)
        limit = 16;

    let current = trim(as_string(new_display_name));
    let prev = trim(as_string(previous_display_name));
    let list = [];

    for (let item in array_or_empty(previous_names)) {
        let name = trim(as_string(item));
        if (name == "" || name == current)
            continue;
        let next_list = [];
        for (let existing in list)
            if (existing != name)
                push(next_list, existing);
        push(next_list, name);
        list = next_list;
    }

    if (prev != "" && prev != current) {
        let next_list = [];
        for (let existing in list)
            if (existing != prev)
                push(next_list, existing);
        push(next_list, prev);
        list = next_list;
    }

    if (length(list) > limit) {
        let trimmed = [];
        for (let i = length(list) - limit; i < length(list); i++)
            push(trimmed, list[i]);
        list = trimmed;
    }

    return list;
}

return {
    connection_id,
    canonical_label,
    merge_alias_history
};
