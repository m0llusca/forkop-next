#!/usr/bin/env ucode

function as_string(value) {
    return value == null ? "" : "" + value;
}

function decimal_text(value, strict) {
    value = as_string(value);
    if (value == "" || match(value, /^[0-9]+$/) == null)
        return false;
    return !strict || length(value) == 1 || substr(value, 0, 1) != "0";
}

function valid_ipv4(value, allow_trailing_dot, strict_decimal) {
    value = as_string(value);
    if (allow_trailing_dot && length(value) > 0 && substr(value, length(value) - 1, 1) == ".")
        value = substr(value, 0, length(value) - 1);

    let parts = split(value, ".");
    if (length(parts) != 4)
        return false;

    for (let part in parts) {
        if (!decimal_text(part, strict_decimal))
            return false;

        let octet = int(part);
        if (octet < 0 || octet > 255)
            return false;
    }

    return true;
}

function valid_ipv4_cidr(value, strict_decimal) {
    value = as_string(value);
    let slash = index(value, "/");
    if (slash <= 0 || index(substr(value, slash + 1), "/") >= 0)
        return false;

    let prefix = substr(value, slash + 1);
    if (!decimal_text(prefix, strict_decimal))
        return false;

    let prefix_number = int(prefix);
    return valid_ipv4(substr(value, 0, slash), false, strict_decimal) && prefix_number >= 0 && prefix_number <= 32;
}

function valid_ipv6_hextet(value) {
    value = as_string(value);
    return value != "" && length(value) <= 4 && match(value, /^[0-9A-Fa-f]+$/) != null;
}

function ipv6_parts_count(parts) {
    let count = 0;

    for (let i = 0; i < length(parts); i++) {
        let part = parts[i];
        if (part == "")
            return -1;

        if (index(part, ".") >= 0) {
            if (i != length(parts) - 1 || !valid_ipv4(part, false, false))
                return -1;
            count += 2;
            continue;
        }

        if (!valid_ipv6_hextet(part))
            return -1;
        count++;
    }

    return count;
}

function valid_ipv6(value) {
    value = as_string(value);
    if (value == "" || index(value, "/") >= 0 || index(value, "%") >= 0)
        return false;

    let marker = index(value, "::");
    if (marker >= 0) {
        if (index(substr(value, marker + 2), "::") >= 0)
            return false;

        let left = substr(value, 0, marker);
        let right = substr(value, marker + 2);
        let left_count = left == "" ? 0 : ipv6_parts_count(split(left, ":"));
        let right_count = right == "" ? 0 : ipv6_parts_count(split(right, ":"));

        return left_count >= 0 && right_count >= 0 && left_count + right_count < 8;
    }

    let count = ipv6_parts_count(split(value, ":"));
    return count == 8;
}

function valid_ipv6_cidr(value) {
    value = as_string(value);
    let slash = index(value, "/");
    if (slash <= 0 || index(substr(value, slash + 1), "/") >= 0)
        return false;

    let prefix = substr(value, slash + 1);
    if (!decimal_text(prefix, false))
        return false;

    let prefix_number = int(prefix);
    return valid_ipv6(substr(value, 0, slash)) && prefix_number >= 0 && prefix_number <= 128;
}

function valid_ip(value) {
    return valid_ipv4(value, false, false) || valid_ipv6(value);
}

function valid_ip_cidr(value) {
    return valid_ipv4_cidr(value, false) || valid_ipv6_cidr(value);
}

function valid_ip_or_cidr(value) {
    return valid_ip(value) || valid_ip_cidr(value);
}

function nft_ip_or_cidr(value) {
    return valid_ipv4(value, true, true) || valid_ipv4_cidr(value, true) || valid_ipv6(value) || valid_ipv6_cidr(value);
}

function ip_family(value) {
    return valid_ipv4(value, false, false) || valid_ipv4_cidr(value, false) ? 4 :
        (valid_ipv6(value) || valid_ipv6_cidr(value) ? 6 : 0);
}

function format_ipv6_tproxy_target(address, port) {
    address = as_string(address);
    if (substr(address, 0, 1) == "[" && substr(address, length(address) - 1, 1) == "]")
        return address + ":" + as_string(port);
    return "[" + address + "]:" + as_string(port);
}

function ipv4_words(value) {
    if (!valid_ipv4(value, false, false))
        return null;
    let parts = split(as_string(value), ".");
    return [ int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]) ];
}

function ipv6_expand_side(side) {
    side = as_string(side);
    if (side == "")
        return [];
    let out = [];
    let parts = split(side, ":");
    for (let i = 0; i < length(parts); i++) {
        let part = parts[i];
        if (index(part, ".") >= 0) {
            let v4 = ipv4_words(part);
            if (v4 == null)
                return null;
            push(out, (v4[0] << 8) | v4[1]);
            push(out, (v4[2] << 8) | v4[3]);
        }
        else {
            push(out, int(part, 16));
        }
    }
    return out;
}

function ipv6_words(value) {
    value = as_string(value);
    if (substr(value, 0, 1) == "[" && substr(value, length(value) - 1, 1) == "]")
        value = substr(value, 1, length(value) - 2);
    if (!valid_ipv6(value))
        return null;

    let marker = index(value, "::");
    if (marker < 0)
        return ipv6_expand_side(value);

    let left = ipv6_expand_side(substr(value, 0, marker));
    let right = ipv6_expand_side(substr(value, marker + 2));
    if (left == null || right == null)
        return null;

    let pad = 8 - length(left) - length(right);
    if (pad <= 0)
        return null;

    let result = [];
    for (let w in left)
        push(result, w);
    for (let i = 0; i < pad; i++)
        push(result, 0);
    for (let w in right)
        push(result, w);
    return result;
}

function ip_in_cidr(ip_val, cidr_val) {
    ip_val = as_string(ip_val);
    cidr_val = as_string(cidr_val);
    if (substr(ip_val, 0, 1) == "[" && substr(ip_val, length(ip_val) - 1, 1) == "]")
        ip_val = substr(ip_val, 1, length(ip_val) - 2);

    let slash = index(cidr_val, "/");
    let net_str = slash >= 0 ? substr(cidr_val, 0, slash) : cidr_val;

    let v4_ip = ipv4_words(ip_val);
    let v4_net = ipv4_words(net_str);
    if (v4_ip != null && v4_net != null) {
        let prefix = slash >= 0 ? int(substr(cidr_val, slash + 1)) : 32;
        if (prefix < 0 || prefix > 32)
            return false;
        let ip_num = (v4_ip[0] << 24) | (v4_ip[1] << 16) | (v4_ip[2] << 8) | v4_ip[3];
        let net_num = (v4_net[0] << 24) | (v4_net[1] << 16) | (v4_net[2] << 8) | v4_net[3];
        if (prefix == 0)
            return true;
        let mask = ((1 << prefix) - 1) << (32 - prefix);
        return (ip_num & mask) == (net_num & mask);
    }

    let v6_ip = ipv6_words(ip_val);
    let v6_net = ipv6_words(net_str);
    if (v6_ip != null && v6_net != null) {
        let prefix = slash >= 0 ? int(substr(cidr_val, slash + 1)) : 128;
        if (prefix < 0 || prefix > 128)
            return false;
        let full_words = int(prefix / 16);
        let rem_bits = prefix % 16;
        for (let i = 0; i < full_words; i++) {
            if (v6_ip[i] != v6_net[i])
                return false;
        }
        if (rem_bits > 0) {
            let mask = ((1 << rem_bits) - 1) << (16 - rem_bits);
            if ((v6_ip[full_words] & mask) != (v6_net[full_words] & mask))
                return false;
        }
        return true;
    }

    return false;
}

function is_disallowed_remote_ip(value) {
    value = as_string(value);
    if (substr(value, 0, 1) == "[" && substr(value, length(value) - 1, 1) == "]")
        value = substr(value, 1, length(value) - 2);

    if (valid_ipv4(value, false, false)) {
        return ip_in_cidr(value, "127.0.0.0/8") ||
            ip_in_cidr(value, "0.0.0.0/8") ||
            ip_in_cidr(value, "169.254.0.0/16") ||
            ip_in_cidr(value, "224.0.0.0/4");
    }

    let v6 = ipv6_words(value);
    if (v6 != null) {
        if (v6[0] == 0 && v6[1] == 0 && v6[2] == 0 && v6[3] == 0 && v6[4] == 0 && v6[5] == 0xffff) {
            let mapped = sprintf("%d.%d.%d.%d", (v6[6] >> 8) & 0xff, v6[6] & 0xff, (v6[7] >> 8) & 0xff, v6[7] & 0xff);
            return is_disallowed_remote_ip(mapped);
        }
        return ip_in_cidr(value, "::1/128") ||
            ip_in_cidr(value, "::/128") ||
            ip_in_cidr(value, "fe80::/10") ||
            ip_in_cidr(value, "ff00::/8");
    }

    return false;
}

return {
    valid_ipv4,
    valid_ipv4_cidr,
    valid_ipv6,
    valid_ipv6_cidr,
    valid_ip,
    valid_ip_cidr,
    valid_ip_or_cidr,
    nft_ip_or_cidr,
    ip_family,
    format_ipv6_tproxy_target,
    ipv4_words,
    ipv6_words,
    ip_in_cidr,
    is_disallowed_remote_ip
};
