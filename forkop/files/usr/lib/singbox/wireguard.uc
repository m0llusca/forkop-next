#!/usr/bin/env ucode
// SPDX-License-Identifier: GPL-2.0-or-later
// WireGuard, AmneziaWG (1-sided & 2-sided), and Cloudflare WARP parsing, serialization, and sing-box endpoint emission.

let common = require("core.common");
let ip = require("core.ip");
let amnezia = require("singbox.amnezia");

let as_string = common.as_string;

const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DEFAULT_WARP_HOST = "engage.cloudflareclient.com";
const DEFAULT_WARP_PORT = 2408;
const DEFAULT_WARP_PEER_PUBLIC_KEY = "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=";
const DEFAULT_ALLOWED_IPS = [ "0.0.0.0/0", "::/0" ];

function last_index_of(text, ch) {
    text = as_string(text);
    for (let i = length(text) - 1; i >= 0; i--) {
        if (substr(text, i, 1) == ch)
            return i;
    }
    return -1;
}

function hex_digit_value(ch) {
    let v = ord(lc(as_string(ch)));
    if (v >= 48 && v <= 57)
        return v - 48;
    if (v >= 97 && v <= 102)
        return v - 87;
    return -1;
}

function percent_decode_raw(value) {
    value = as_string(value);
    let out = "";
    for (let i = 0; i < length(value); i++) {
        let c = substr(value, i, 1);
        if (c == "%" && i + 2 < length(value)) {
            let hi = hex_digit_value(substr(value, i + 1, 1));
            let lo = hex_digit_value(substr(value, i + 2, 1));
            if (hi >= 0 && lo >= 0) {
                out += chr(hi * 16 + lo);
                i += 2;
                continue;
            }
        }
        out += c;
    }
    return out;
}

function percent_encode_component(value) {
    value = as_string(value);
    let out = "";
    for (let i = 0; i < length(value); i++) {
        let c = substr(value, i, 1);
        let b = ord(c);
        if ((b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) ||
            c == "-" || c == "_" || c == "." || c == "~") {
            out += c;
        }
        else {
            out += sprintf("%%%02X", b & 0xff);
        }
    }
    return out;
}

function b64_val(ch) {
    if (ch == "-")
        ch = "+";
    else if (ch == "_")
        ch = "/";
    return index(B64_STD, ch);
}

function decode_base64_bytes(b64_str) {
    if (b64_str == null)
        return null;
    let clean = replace(as_string(b64_str), /[ \t\r\n]/g, "");
    if (clean == "")
        return null;

    while (length(clean) % 4 != 0)
        clean += "=";

    let len = length(clean);
    let pad = 0;
    if (len >= 2) {
        if (substr(clean, len - 1, 1) == "=")
            pad++;
        if (substr(clean, len - 2, 1) == "=")
            pad++;
    }

    let bytes = [];
    for (let i = 0; i < len; i += 4) {
        let c0 = substr(clean, i, 1);
        let c1 = substr(clean, i + 1, 1);
        let c2 = substr(clean, i + 2, 1);
        let c3 = substr(clean, i + 3, 1);

        let v0 = b64_val(c0);
        let v1 = b64_val(c1);
        if (v0 < 0 || v1 < 0)
            return null;

        let v2 = 0;
        let v3 = 0;
        if (c2 == "=") {
            if (i + 4 != len || c3 != "=")
                return null;
        }
        else {
            v2 = b64_val(c2);
            if (v2 < 0)
                return null;
        }

        if (c3 == "=") {
            if (i + 4 != len)
                return null;
        }
        else {
            v3 = b64_val(c3);
            if (v3 < 0)
                return null;
        }

        let triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
        push(bytes, (triple >> 16) & 0xff);
        if (c2 != "=")
            push(bytes, (triple >> 8) & 0xff);
        if (c3 != "=")
            push(bytes, triple & 0xff);
    }

    return bytes;
}

function encode_base64_bytes(bytes) {
    if (type(bytes) != "array")
        return "";

    let out = "";
    let n = length(bytes);
    for (let i = 0; i < n; i += 3) {
        let b0 = int(bytes[i]) & 0xff;
        let has1 = i + 1 < n;
        let has2 = i + 2 < n;
        let b1 = has1 ? (int(bytes[i + 1]) & 0xff) : 0;
        let b2 = has2 ? (int(bytes[i + 2]) & 0xff) : 0;

        let triple = (b0 << 16) | (b1 << 8) | b2;
        out += substr(B64_STD, (triple >> 18) & 0x3f, 1);
        out += substr(B64_STD, (triple >> 12) & 0x3f, 1);
        out += has1 ? substr(B64_STD, (triple >> 6) & 0x3f, 1) : "=";
        out += has2 ? substr(B64_STD, triple & 0x3f, 1) : "=";
    }
    return out;
}

function normalize_wg_key(raw_key) {
    let bytes = decode_base64_bytes(raw_key);
    if (bytes == null || length(bytes) != 32)
        return "";
    return encode_base64_bytes(bytes);
}

function parse_reserved(val) {
    if (val == null)
        return null;

    if (type(val) == "array") {
        if (length(val) != 3)
            return null;
        let out = [];
        for (let item in val) {
            let s = trim(as_string(item));
            if (!match(s, /^[0-9]+$/))
                return null;
            let b = int(s, 10);
            if (b < 0 || b > 255)
                return null;
            push(out, b);
        }
        return out;
    }

    let text = trim(as_string(val));
    if (text == "")
        return null;

    if (index(text, ",") >= 0) {
        if (substr(text, 0, 1) == "[" && substr(text, length(text) - 1, 1) == "]")
            text = substr(text, 1, length(text) - 2);
        let parts = split(text, ",");
        return parse_reserved(parts);
    }

    let decoded = decode_base64_bytes(text);
    if (decoded != null && length(decoded) == 3)
        return decoded;

    return null;
}

function normalize_cidr_entry(raw_addr) {
    let s = trim(as_string(raw_addr));
    if (s == "")
        return "";

    if (ip.valid_ipv4_cidr(s, false) || ip.valid_ipv6_cidr(s))
        return s;
    if (ip.valid_ipv4(s, false, false))
        return s + "/32";
    if (ip.valid_ipv6(s))
        return s + "/128";
    return "";
}

function normalize_cidr_list(raw_val) {
    let items = [];
    if (type(raw_val) == "array") {
        items = raw_val;
    }
    else {
        let s = trim(as_string(raw_val));
        if (s != "")
            items = split(s, ",");
    }

    let out = [];
    let seen = {};
    for (let raw_item in items) {
        let norm = normalize_cidr_entry(raw_item);
        if (norm != "" && !seen[norm]) {
            seen[norm] = true;
            push(out, norm);
        }
    }
    return out;
}

function parse_host_port(hostport, default_port) {
    hostport = trim(as_string(hostport));
    if (hostport == "")
        return null;

    let host = "";
    let port_str = "";

    if (substr(hostport, 0, 1) == "[") {
        let close = index(hostport, "]");
        if (close <= 1)
            return null;
        host = substr(hostport, 1, close - 1);
        if (!ip.valid_ipv6(host))
            return null;
        let tail = substr(hostport, close + 1);
        if (tail != "") {
            if (substr(tail, 0, 1) != ":")
                return null;
            port_str = substr(tail, 1);
        }
    }
    else {
        let first_colon = index(hostport, ":");
        let last_colon = last_index_of(hostport, ":");
        if (first_colon >= 0 && first_colon == last_colon) {
            host = substr(hostport, 0, first_colon);
            port_str = substr(hostport, first_colon + 1);
        }
        else if (first_colon < 0) {
            host = hostport;
        }
        else if (ip.valid_ipv6(hostport)) {
            host = hostport;
        }
        else {
            return null;
        }
    }

    host = trim(host);
    if (host == "")
        return null;

    let port = int(default_port || 0);
    if (port_str != "") {
        if (!match(port_str, /^[0-9]+$/))
            return null;
        port = int(port_str, 10);
    }

    if (port < 1 || port > 65535)
        return null;

    return { host, port };
}

function positive_int(val, min_v, max_v) {
    if (val == null)
        return null;
    let s = trim(as_string(val));
    if (!match(s, /^[0-9]+$/))
        return null;
    let n = int(s, 10);
    if (n < min_v || n > max_v)
        return null;
    return n;
}

function parse_share_link(link, default_tag) {
    link = trim(as_string(link));
    let scheme_pos = index(link, "://");
    if (scheme_pos <= 0)
        return null;

    let scheme = lc(substr(link, 0, scheme_pos));
    if (index([ "wireguard", "wg", "awg", "amneziawg", "warp" ], scheme) < 0)
        return null;

    let rest = substr(link, scheme_pos + 3);
    let frag_pos = index(rest, "#");
    let fragment = frag_pos >= 0 ? trim(percent_decode_raw(substr(rest, frag_pos + 1))) : "";
    let before_frag = frag_pos >= 0 ? substr(rest, 0, frag_pos) : rest;

    let q_pos = index(before_frag, "?");
    let auth_part = q_pos >= 0 ? substr(before_frag, 0, q_pos) : before_frag;
    let query_str = q_pos >= 0 ? substr(before_frag, q_pos + 1) : "";

    let at_pos = last_index_of(auth_part, "@");
    let userinfo = at_pos >= 0 ? percent_decode_raw(substr(auth_part, 0, at_pos)) : "";
    let hostport = at_pos >= 0 ? substr(auth_part, at_pos + 1) : auth_part;
    while (length(hostport) > 0 && substr(hostport, length(hostport) - 1, 1) == "/")
        hostport = substr(hostport, 0, length(hostport) - 1);

    let params = {};
    if (query_str != "") {
        for (let pair in split(query_str, "&")) {
            if (pair == "")
                continue;
            let eq = index(pair, "=");
            let k = lc(trim(percent_decode_raw(eq >= 0 ? substr(pair, 0, eq) : pair)));
            let v = eq >= 0 ? percent_decode_raw(substr(pair, eq + 1)) : "";
            if (k != "")
                params[k] = v;
        }
    }

    let awg_obj = amnezia.normalize(params);
    if (awg_obj != null) {
        let v = amnezia.validate(awg_obj, scheme == "warp");
        if (!v.valid)
            return null;
    }

    let mtu = positive_int(params.mtu, 576, 65535);
    let keepalive = positive_int(params.keepalive || params["persistent-keepalive"] || params.persistent_keepalive, 1, 65535);
    let reserved = parse_reserved(params.reserved);

    if (scheme == "warp") {
        let hp = (hostport == "" || lc(hostport) == "auto")
            ? { host: DEFAULT_WARP_HOST, port: DEFAULT_WARP_PORT }
            : parse_host_port(hostport, DEFAULT_WARP_PORT);
        if (hp == null)
            return null;
        if (lc(hp.host) == "auto")
            hp.host = DEFAULT_WARP_HOST;

        let priv_raw = params.privatekey || params.private_key || params["private-key"] || userinfo;
        let priv = priv_raw != null && priv_raw != "" ? normalize_wg_key(priv_raw) : "";
        if (priv_raw != null && priv_raw != "" && priv == "")
            return null;

        let pub_raw = params.publickey || params.public_key || params["public-key"] || "";
        let pub = pub_raw != "" ? normalize_wg_key(pub_raw) : DEFAULT_WARP_PEER_PUBLIC_KEY;
        if (pub_raw != "" && pub == "")
            return null;

        let local_addrs = normalize_cidr_list(params.address || params.ip || "");
        let reg_id = trim(as_string(params.id || params.device_id || ""));
        let auth_token = trim(as_string(params.token || params.auth_token || ""));
        let license_key = trim(as_string(params.license || params.license_key || ""));

        let tag = fragment != "" ? fragment : (as_string(default_tag || "") != "" ? as_string(default_tag) : "WARP");
        let ep = {
            type: "warp",
            tag,
            address: hp.host,
            port: hp.port
        };

        if (length(local_addrs) > 0)
            ep.local_address = local_addrs;
        if (priv != "")
            ep.private_key = priv;
        if (pub != "")
            ep.peer_public_key = pub;
        if (reserved != null)
            ep.reserved = reserved;
        if (mtu != null)
            ep.mtu = mtu;
        if (keepalive != null)
            ep.persistent_keepalive_interval = keepalive;

        if (reg_id != "" || auth_token != "" || license_key != "" || priv != "") {
            let profile = {};
            if (reg_id != "")
                profile.id = reg_id;
            if (auth_token != "")
                profile.auth_token = auth_token;
            if (priv != "")
                profile.private_key = priv;
            if (license_key != "")
                profile.license_key = license_key;
            ep.profile = profile;
        }

        if (awg_obj != null)
            ep.amnezia = awg_obj;

        return ep;
    }

    // Standard WireGuard / AmneziaWG link
    let hp = parse_host_port(hostport, 51820);
    if (hp == null)
        return null;

    let priv = normalize_wg_key(userinfo != "" ? userinfo : (params.privatekey || params.private_key || params["private-key"] || ""));
    let pub = normalize_wg_key(params.publickey || params.public_key || params["public-key"] || "");
    if (priv == "" || pub == "")
        return null;

    let psk_raw = params.psk || params.presharedkey || params.pre_shared_key || params["pre-shared-key"] || "";
    let psk = psk_raw != "" ? normalize_wg_key(psk_raw) : "";
    if (psk_raw != "" && psk == "")
        return null;

    let local_addrs = normalize_cidr_list(params.address || params.ip || "10.0.0.2/32");
    if (length(local_addrs) == 0)
        return null;

    let allowed = normalize_cidr_list(params.allowedips || params.allowed_ips || "");
    if (length(allowed) == 0)
        allowed = [ ...DEFAULT_ALLOWED_IPS ];

    let peer = {
        address: hp.host,
        port: hp.port,
        public_key: pub,
        allowed_ips: allowed
    };
    if (psk != "")
        peer.pre_shared_key = psk;
    if (keepalive != null)
        peer.persistent_keepalive_interval = keepalive;
    if (reserved != null)
        peer.reserved = reserved;

    let tag = fragment != "" ? fragment : (as_string(default_tag || "") != "" ? as_string(default_tag) : (hp.host + ":" + hp.port));
    let out = {
        type: "wireguard",
        tag,
        address: local_addrs,
        private_key: priv,
        peers: [ peer ]
    };
    if (mtu != null)
        out.mtu = mtu;
    if (awg_obj != null)
        out.amnezia = awg_obj;

    return out;
}

function parse_wg_conf(text, default_tag) {
    if (type(text) != "string" || trim(text) == "")
        return null;

    let iface = {};
    let peers_raw = [];
    let current_section = "";
    let current_peer = null;
    let comment_tag = "";

    for (let raw_line in split(replace(text, /\r/g, ""), "\n")) {
        let line = trim(raw_line);
        if (line == "")
            continue;

        if (substr(line, 0, 1) == "#" || substr(line, 0, 1) == ";") {
            let body = trim(substr(line, 1));
            if (comment_tag == "" && match(lc(body), /^(name|tag)[ \t]*[:=]/)) {
                let sep = index(body, ":") >= 0 ? index(body, ":") : index(body, "=");
                comment_tag = trim(substr(body, sep + 1));
            }
            continue;
        }

        if (substr(line, 0, 1) == "[" && substr(line, length(line) - 1, 1) == "]") {
            let sec = lc(trim(substr(line, 1, length(line) - 2)));
            current_section = sec;
            if (sec == "peer") {
                current_peer = {};
                push(peers_raw, current_peer);
            }
            continue;
        }

        let eq = index(line, "=");
        if (eq <= 0)
            continue;

        let k = lc(trim(substr(line, 0, eq)));
        let v = trim(substr(line, eq + 1));
        if (k == "" || v == "")
            continue;

        if (current_section == "interface") {
            if (k == "address" && iface.address != null)
                iface.address = iface.address + "," + v;
            else
                iface[k] = v;
        }
        else if (current_section == "peer" && current_peer != null) {
            if (k == "allowedips" && current_peer.allowedips != null)
                current_peer.allowedips = current_peer.allowedips + "," + v;
            else
                current_peer[k] = v;
        }
    }

    let priv = normalize_wg_key(iface.privatekey || iface.private_key || "");
    let addrs = normalize_cidr_list(iface.address || "");
    if (priv == "" || length(addrs) == 0 || length(peers_raw) == 0)
        return null;

    let awg_obj = amnezia.normalize(iface);
    if (awg_obj != null) {
        let v = amnezia.validate(awg_obj, false);
        if (!v.valid)
            return null;
    }

    let peers = [];
    for (let pr in peers_raw) {
        let hp = parse_host_port(pr.endpoint || "", 51820);
        let pub = normalize_wg_key(pr.publickey || pr.public_key || "");
        if (hp == null || pub == "")
            return null;

        let psk_raw = pr.presharedkey || pr.pre_shared_key || "";
        let psk = psk_raw != "" ? normalize_wg_key(psk_raw) : "";
        if (psk_raw != "" && psk == "")
            return null;

        let allowed = normalize_cidr_list(pr.allowedips || pr.allowed_ips || "");
        if (length(allowed) == 0)
            allowed = [ ...DEFAULT_ALLOWED_IPS ];

        let keepalive = positive_int(pr.persistentkeepalive || pr.persistent_keepalive, 1, 65535);
        let reserved = parse_reserved(pr.reserved);

        let peer = {
            address: hp.host,
            port: hp.port,
            public_key: pub,
            allowed_ips: allowed
        };
        if (psk != "")
            peer.pre_shared_key = psk;
        if (keepalive != null)
            peer.persistent_keepalive_interval = keepalive;
        if (reserved != null)
            peer.reserved = reserved;

        push(peers, peer);
    }

    let first_peer = peers[0];
    let tag = as_string(default_tag || "");
    if (tag == "")
        tag = comment_tag != "" ? comment_tag : (first_peer.address + ":" + first_peer.port);

    let out = {
        type: "wireguard",
        tag,
        address: addrs,
        private_key: priv,
        peers
    };

    let mtu = positive_int(iface.mtu, 576, 65535);
    if (mtu != null)
        out.mtu = mtu;
    if (awg_obj != null)
        out.amnezia = awg_obj;

    return out;
}

function parse_clash_wireguard(record) {
    if (type(record) != "object" || record == null)
        return null;
    if (lc(as_string(record.type || "")) != "wireguard")
        return null;

    let priv = normalize_wg_key(record["private-key"] || record.private_key || "");
    if (priv == "")
        return null;

    let addr_candidates = [];
    if (type(record.address) == "array") {
        for (let a in record.address)
            push(addr_candidates, a);
    }
    if (record.ip != null && as_string(record.ip) != "")
        push(addr_candidates, record.ip);
    if (record.ipv6 != null && as_string(record.ipv6) != "")
        push(addr_candidates, record.ipv6);

    let addrs = normalize_cidr_list(addr_candidates);
    if (length(addrs) == 0)
        return null;

    let awg_raw = record["amnezia-wg-option"] || record.amnezia_wg_option || record.amnezia || null;
    let awg_obj = awg_raw != null ? amnezia.normalize(awg_raw) : null;
    if (awg_obj != null) {
        let v = amnezia.validate(awg_obj, false);
        if (!v.valid)
            return null;
    }

    let top_keepalive = positive_int(record["persistent-keepalive"] || record.persistent_keepalive || record.keepalive, 1, 65535);
    let top_reserved = parse_reserved(record.reserved);

    let peers = [];
    if (type(record.peers) == "array" && length(record.peers) > 0) {
        for (let cp in record.peers) {
            if (type(cp) != "object" || cp == null)
                continue;
            let host = trim(as_string(cp.server || record.server || ""));
            let port = positive_int(cp.port != null ? cp.port : record.port, 1, 65535);
            let pub = normalize_wg_key(cp["public-key"] || cp.public_key || "");
            if (host == "" || port == null || pub == "")
                return null;
            if (substr(host, 0, 1) == "[" && substr(host, length(host) - 1, 1) == "]")
                host = substr(host, 1, length(host) - 2);

            let psk_raw = cp["pre-shared-key"] || cp["preshared-key"] || cp.pre_shared_key || "";
            let psk = psk_raw != "" ? normalize_wg_key(psk_raw) : "";
            if (psk_raw != "" && psk == "")
                return null;

            let allowed = normalize_cidr_list(cp["allowed-ips"] || cp.allowed_ips || "");
            if (length(allowed) == 0)
                allowed = [ ...DEFAULT_ALLOWED_IPS ];

            let peer_res = parse_reserved(cp.reserved != null ? cp.reserved : top_reserved);
            let peer = {
                address: host,
                port,
                public_key: pub,
                allowed_ips: allowed
            };
            if (psk != "")
                peer.pre_shared_key = psk;
            if (top_keepalive != null)
                peer.persistent_keepalive_interval = top_keepalive;
            if (peer_res != null)
                peer.reserved = peer_res;
            push(peers, peer);
        }
    }
    else {
        let host = trim(as_string(record.server || ""));
        let port = positive_int(record.port, 1, 65535);
        let pub = normalize_wg_key(record["public-key"] || record.public_key || "");
        if (host == "" || port == null || pub == "")
            return null;
        if (substr(host, 0, 1) == "[" && substr(host, length(host) - 1, 1) == "]")
            host = substr(host, 1, length(host) - 2);

        let psk_raw = record["pre-shared-key"] || record["preshared-key"] || record.pre_shared_key || "";
        let psk = psk_raw != "" ? normalize_wg_key(psk_raw) : "";
        if (psk_raw != "" && psk == "")
            return null;

        let allowed = normalize_cidr_list(record["allowed-ips"] || record.allowed_ips || "");
        if (length(allowed) == 0)
            allowed = [ ...DEFAULT_ALLOWED_IPS ];

        let peer = {
            address: host,
            port,
            public_key: pub,
            allowed_ips: allowed
        };
        if (psk != "")
            peer.pre_shared_key = psk;
        if (top_keepalive != null)
            peer.persistent_keepalive_interval = top_keepalive;
        if (top_reserved != null)
            peer.reserved = top_reserved;
        push(peers, peer);
    }

    if (length(peers) == 0)
        return null;

    let tag = trim(as_string(record.name || record.tag || ""));
    if (tag == "")
        tag = peers[0].address + ":" + peers[0].port;

    let out = {
        type: "wireguard",
        tag,
        address: addrs,
        private_key: priv,
        peers
    };

    let mtu = positive_int(record.mtu, 576, 65535);
    if (mtu != null)
        out.mtu = mtu;
    if (awg_obj != null)
        out.amnezia = awg_obj;

    return out;
}

function format_uri_host_port(host, port) {
    host = as_string(host);
    if (ip.valid_ipv6(host))
        return "[" + host + "]:" + port;
    return host + ":" + port;
}

function serialize_share_link(endpoint) {
    if (type(endpoint) != "object" || endpoint == null)
        return "";

    let ep_type = lc(as_string(endpoint.type || ""));
    let awg_obj = endpoint.amnezia != null ? amnezia.normalize(endpoint.amnezia) : null;

    if (ep_type == "warp") {
        let host = trim(as_string(endpoint.address || DEFAULT_WARP_HOST));
        let port = positive_int(endpoint.port, 1, 65535) || DEFAULT_WARP_PORT;
        let profile = common.object_or_empty(endpoint.profile);
        let priv = as_string(endpoint.private_key || profile.private_key || "");
        let pub = as_string(endpoint.peer_public_key || "");
        let local_addrs = normalize_cidr_list(endpoint.local_address || []);
        let reserved = parse_reserved(endpoint.reserved);
        let mtu = positive_int(endpoint.mtu, 576, 65535);
        let keepalive = positive_int(endpoint.persistent_keepalive_interval, 1, 65535);

        let q = [];
        if (priv != "")
            push(q, "privatekey=" + percent_encode_component(priv));
        if (pub != "")
            push(q, "publickey=" + percent_encode_component(pub));
        if (length(local_addrs) > 0)
            push(q, "address=" + percent_encode_component(join(",", local_addrs)));
        if (reserved != null)
            push(q, "reserved=" + join(",", reserved));
        if (as_string(profile.id || "") != "")
            push(q, "id=" + percent_encode_component(profile.id));
        if (as_string(profile.auth_token || "") != "")
            push(q, "token=" + percent_encode_component(profile.auth_token));
        if (as_string(profile.license_key || "") != "")
            push(q, "license=" + percent_encode_component(profile.license_key));
        if (mtu != null)
            push(q, "mtu=" + mtu);
        if (keepalive != null)
            push(q, "keepalive=" + keepalive);

        if (awg_obj != null) {
            for (let k in amnezia.ONE_SIDED_KEYS) {
                if (exists(awg_obj, k))
                    push(q, k + "=" + percent_encode_component(awg_obj[k]));
            }
        }

        let uri = "warp://" + format_uri_host_port(host, port);
        if (length(q) > 0)
            uri += "?" + join("&", q);
        if (as_string(endpoint.tag || "") != "")
            uri += "#" + percent_encode_component(endpoint.tag);
        return uri;
    }

    if (ep_type != "wireguard")
        return "";

    let peers = common.array_or_empty(endpoint.peers);
    if (length(peers) == 0 || type(peers[0]) != "object")
        return "";

    let peer = peers[0];
    let priv = as_string(endpoint.private_key || "");
    let pub = as_string(peer.public_key || "");
    let host = as_string(peer.address || "");
    let port = positive_int(peer.port, 1, 65535) || 51820;
    if (priv == "" || pub == "" || host == "")
        return "";

    let scheme = awg_obj != null ? "amneziawg" : "wireguard";
    let addrs = normalize_cidr_list(endpoint.address || []);
    let q = [];
    if (length(addrs) > 0)
        push(q, "address=" + percent_encode_component(join(",", addrs)));
    push(q, "publickey=" + percent_encode_component(pub));
    if (as_string(peer.pre_shared_key || "") != "")
        push(q, "psk=" + percent_encode_component(peer.pre_shared_key));
    if (endpoint.mtu != null)
        push(q, "mtu=" + endpoint.mtu);
    if (peer.persistent_keepalive_interval != null)
        push(q, "keepalive=" + peer.persistent_keepalive_interval);
    let reserved = parse_reserved(peer.reserved);
    if (reserved != null)
        push(q, "reserved=" + join(",", reserved));

    if (awg_obj != null) {
        for (let k in amnezia.ALL_KEYS) {
            if (exists(awg_obj, k))
                push(q, k + "=" + percent_encode_component(awg_obj[k]));
        }
    }

    let uri = scheme + "://" + percent_encode_component(priv) + "@" + format_uri_host_port(host, port);
    if (length(q) > 0)
        uri += "?" + join("&", q);
    if (as_string(endpoint.tag || "") != "")
        uri += "#" + percent_encode_component(endpoint.tag);
    return uri;
}

function copy_routing_fields(src, dst) {
    for (let field in [ "detour", "domain_resolver", "routing_mark", "bind_interface", "inet4_bind_address", "inet6_bind_address" ]) {
        if (src[field] != null && src[field] != "")
            dst[field] = src[field];
    }
}

function to_singbox_endpoint(item, is_extended_core) {
    if (type(item) != "object" || item == null)
        return { endpoint: null, unsupported_reason: "invalid_endpoint" };

    let ep_type = lc(as_string(item.type || ""));
    let tag = as_string(item.tag || "");
    if (tag == "")
        return { endpoint: null, unsupported_reason: "missing_tag" };

    let awg_obj = item.amnezia != null ? amnezia.normalize(item.amnezia) : null;

    if (ep_type == "warp") {
        if (is_extended_core) {
            if (awg_obj != null) {
                let v = amnezia.validate(awg_obj, true);
                if (!v.valid)
                    return { endpoint: null, unsupported_reason: "warp_supports_one_sided_amnezia_only" };
            }

            let raw_prof = common.object_or_empty(item.profile);
            let priv = normalize_wg_key(raw_prof.private_key || item.private_key || "");
            let out = {
                type: "warp",
                tag
            };

            let host = type(item.address) == "string" ? trim(item.address) : "";
            if (host != "" && lc(host) != "auto")
                out.address = host;

            let port = positive_int(item.port, 1, 65535);
            if (port != null)
                out.port = port;

            let keepalive = positive_int(item.persistent_keepalive_interval, 1, 65535);
            if (keepalive != null)
                out.persistent_keepalive_interval = keepalive;

            let prof = {};
            if (as_string(raw_prof.id || "") != "")
                prof.id = as_string(raw_prof.id);
            if (as_string(raw_prof.auth_token || "") != "")
                prof.auth_token = as_string(raw_prof.auth_token);
            if (priv != "")
                prof.private_key = priv;
            if (as_string(raw_prof.license_key || "") != "")
                prof.license_key = as_string(raw_prof.license_key);
            if (length(keys(prof)) > 0)
                out.profile = prof;

            if (awg_obj != null)
                out.amnezia = awg_obj;

            copy_routing_fields(item, out);
            return { endpoint: out, unsupported_reason: null };
        }

        // Stock sing-box fallback for WARP (1.13.7 / 1.14.3): requires standard WireGuard tunnel fields and NO AmneziaWG
        if (awg_obj != null)
            return { endpoint: null, unsupported_reason: "amnezia_requires_extended_core" };

        let raw_prof = common.object_or_empty(item.profile);
        let priv = normalize_wg_key(item.private_key || raw_prof.private_key || "");
        let local_addrs = normalize_cidr_list(item.local_address || (type(item.address) == "array" ? item.address : []));
        let peer_pub = normalize_wg_key(item.peer_public_key || DEFAULT_WARP_PEER_PUBLIC_KEY);

        if (priv == "" || length(local_addrs) == 0 || peer_pub == "")
            return { endpoint: null, unsupported_reason: "warp_requires_extended_core_or_wg_fallback" };

        let host = (type(item.address) == "string" && trim(item.address) != "" && lc(trim(item.address)) != "auto")
            ? trim(item.address)
            : DEFAULT_WARP_HOST;
        let port = positive_int(item.port, 1, 65535) || DEFAULT_WARP_PORT;
        let peer = {
            address: host,
            port,
            public_key: peer_pub,
            allowed_ips: [ ...DEFAULT_ALLOWED_IPS ]
        };

        let keepalive = positive_int(item.persistent_keepalive_interval, 1, 65535);
        if (keepalive != null)
            peer.persistent_keepalive_interval = keepalive;

        let reserved = parse_reserved(item.reserved);
        if (reserved != null)
            peer.reserved = reserved;

        let out = {
            type: "wireguard",
            tag,
            address: local_addrs,
            private_key: priv,
            peers: [ peer ]
        };

        let mtu = positive_int(item.mtu, 576, 65535);
        if (mtu != null)
            out.mtu = mtu;

        copy_routing_fields(item, out);
        return { endpoint: out, unsupported_reason: null };
    }

    if (ep_type != "wireguard")
        return { endpoint: null, unsupported_reason: "unsupported_endpoint_type" };

    if (awg_obj != null) {
        if (!is_extended_core)
            return { endpoint: null, unsupported_reason: "amnezia_requires_extended_core" };
        let v = amnezia.validate(awg_obj, false);
        if (!v.valid)
            return { endpoint: null, unsupported_reason: "invalid_amnezia_options" };
    }

    let priv = normalize_wg_key(item.private_key || "");
    let addrs = normalize_cidr_list(item.address || []);
    let raw_peers = common.array_or_empty(item.peers);
    if (priv == "" || length(addrs) == 0 || length(raw_peers) == 0)
        return { endpoint: null, unsupported_reason: "invalid_wireguard_endpoint" };

    let peers = [];
    for (let rp in raw_peers) {
        if (type(rp) != "object" || rp == null)
            continue;
        let host = trim(as_string(rp.address || rp.server || ""));
        let port = positive_int(rp.port != null ? rp.port : rp.server_port, 1, 65535);
        let pub = normalize_wg_key(rp.public_key || "");
        if (host == "" || port == null || pub == "")
            return { endpoint: null, unsupported_reason: "invalid_wireguard_peer" };

        let allowed = normalize_cidr_list(rp.allowed_ips || []);
        if (length(allowed) == 0)
            allowed = [ ...DEFAULT_ALLOWED_IPS ];

        let peer = {
            address: host,
            port,
            public_key: pub,
            allowed_ips: allowed
        };

        if (as_string(rp.pre_shared_key || "") != "") {
            let psk = normalize_wg_key(rp.pre_shared_key);
            if (psk == "")
                return { endpoint: null, unsupported_reason: "invalid_wireguard_psk" };
            peer.pre_shared_key = psk;
        }

        let keepalive = positive_int(rp.persistent_keepalive_interval, 1, 65535);
        if (keepalive != null)
            peer.persistent_keepalive_interval = keepalive;

        // Stock sing-box accepts peers[].reserved; sing-box-extended rejects unknown field "reserved".
        if (!is_extended_core) {
            let reserved = parse_reserved(rp.reserved);
            if (reserved != null)
                peer.reserved = reserved;
        }

        push(peers, peer);
    }

    if (length(peers) == 0)
        return { endpoint: null, unsupported_reason: "invalid_wireguard_peer" };

    let out = {
        type: "wireguard",
        tag,
        address: addrs,
        private_key: priv,
        peers
    };

    let mtu = positive_int(item.mtu, 576, 65535);
    if (mtu != null)
        out.mtu = mtu;

    if (is_extended_core && awg_obj != null)
        out.amnezia = awg_obj;

    copy_routing_fields(item, out);
    return { endpoint: out, unsupported_reason: null };
}

return {
    decode_base64_bytes,
    encode_base64_bytes,
    normalize_wg_key,
    parse_reserved,
    parse_share_link,
    parse_wg_conf,
    parse_clash_wireguard,
    serialize_share_link,
    to_singbox_endpoint
};
