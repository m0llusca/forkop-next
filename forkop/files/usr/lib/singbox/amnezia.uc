#!/usr/bin/env ucode
// SPDX-License-Identifier: GPL-2.0-or-later
// AmneziaWG 1-sided (jc/jmin/jmax/i1..i5) and 2-sided (s1..s4/h1..h4) normalization & validation.

let common = require("core.common");
let as_string = common.as_string;

const ONE_SIDED_KEYS = [ "jc", "jmin", "jmax", "i1", "i2", "i3", "i4", "i5" ];
const TWO_SIDED_KEYS = [ "s1", "s2", "s3", "s4", "h1", "h2", "h3", "h4" ];
const ALL_KEYS = [
    "jc", "jmin", "jmax",
    "s1", "s2", "s3", "s4",
    "h1", "h2", "h3", "h4",
    "i1", "i2", "i3", "i4", "i5"
];

const INT_KEYS = {
    jc: true,
    jmin: true,
    jmax: true,
    s1: true,
    s2: true,
    s3: true,
    s4: true
};

const HEADER_KEYS = {
    h1: true,
    h2: true,
    h3: true,
    h4: true
};

const CPS_KEYS = {
    i1: true,
    i2: true,
    i3: true,
    i4: true,
    i5: true
};

const MAX_U32 = 4294967295;

function default_one_sided_preset() {
    return {
        jc: 4,
        jmin: 40,
        jmax: 70
    };
}

function canonical_key(raw_key) {
    let k = lc(trim(as_string(raw_key)));
    k = replace(k, /[_-]/g, "");
    return index(ALL_KEYS, k) >= 0 ? k : "";
}

function normalize_header_value(val) {
    if (type(val) == "int")
        return val;

    let s = trim(as_string(val));
    if (s == "")
        return null;

    if (match(s, /^[0-9]+$/))
        return int(s, 10);

    let compact = replace(s, /[ \t]+/g, "");
    if (match(compact, /^[0-9]+-[0-9]+$/))
        return compact;

    return val;
}

function normalize(raw_map) {
    if (type(raw_map) != "object" || raw_map == null)
        return null;

    let out = {};
    let count = 0;

    for (let raw_k in keys(raw_map)) {
        let k = canonical_key(raw_k);
        if (k == "")
            continue;

        let raw_v = raw_map[raw_k];
        if (raw_v == null)
            continue;
        if (type(raw_v) == "string" && trim(raw_v) == "")
            continue;

        if (INT_KEYS[k]) {
            if (type(raw_v) == "int") {
                out[k] = raw_v;
            }
            else {
                let s = trim(as_string(raw_v));
                out[k] = match(s, /^-?[0-9]+$/) ? int(s, 10) : raw_v;
            }
            count++;
        }
        else if (HEADER_KEYS[k]) {
            let hv = normalize_header_value(raw_v);
            if (hv != null) {
                out[k] = hv;
                count++;
            }
        }
        else if (CPS_KEYS[k]) {
            let sv = trim(as_string(raw_v));
            if (sv != "") {
                out[k] = sv;
                count++;
            }
        }
    }

    if (count == 0)
        return null;

    // Emit keys in deterministic canonical order
    let ordered = {};
    for (let k in ALL_KEYS) {
        if (exists(out, k))
            ordered[k] = out[k];
    }
    return ordered;
}

function is_two_sided(amnezia_obj) {
    if (type(amnezia_obj) != "object" || amnezia_obj == null)
        return false;

    for (let k in keys(amnezia_obj)) {
        let ck = canonical_key(k);
        if (index(TWO_SIDED_KEYS, ck) >= 0 && amnezia_obj[k] != null && as_string(amnezia_obj[k]) != "")
            return true;
    }
    return false;
}

function parse_header_range(val) {
    if (type(val) == "int") {
        if (val < 0 || val > MAX_U32)
            return null;
        return { min: val, max: val };
    }

    if (type(val) != "string")
        return null;

    let s = trim(val);
    if (match(s, /^[0-9]+$/)) {
        let n = int(s, 10);
        if (n < 0 || n > MAX_U32)
            return null;
        return { min: n, max: n };
    }

    if (match(s, /^[0-9]+-[0-9]+$/)) {
        let dash = index(s, "-");
        let lo = int(substr(s, 0, dash), 10);
        let hi = int(substr(s, dash + 1), 10);
        if (lo < 0 || hi < lo || hi > MAX_U32)
            return null;
        return { min: lo, max: hi };
    }

    return null;
}

function fail(error, message) {
    return { valid: false, error, message };
}

function validate(amnezia_obj, one_sided_only) {
    if (type(amnezia_obj) != "object" || amnezia_obj == null || length(keys(amnezia_obj)) == 0)
        return fail("empty_amnezia", "AmneziaWG options must be a non-empty object");

    for (let k in keys(amnezia_obj)) {
        if (index(ALL_KEYS, k) < 0)
            return fail("unknown_amnezia_key", "Unsupported AmneziaWG parameter: " + as_string(k));
    }

    if (one_sided_only && is_two_sided(amnezia_obj))
        return fail("two_sided_not_allowed", "2-sided AmneziaWG parameters (s1..s4, h1..h4) are not allowed in 1-sided mode");

    let has_other_obf = is_two_sided(amnezia_obj) ||
        exists(amnezia_obj, "i1") || exists(amnezia_obj, "i2") ||
        exists(amnezia_obj, "i3") || exists(amnezia_obj, "i4") || exists(amnezia_obj, "i5");

    if (exists(amnezia_obj, "jc")) {
        let jc = amnezia_obj.jc;
        let min_jc = has_other_obf ? 0 : 1;
        if (type(jc) != "int" || jc < min_jc || jc > 128)
            return fail("invalid_jc", "jc must be an integer between " + min_jc + " and 128");
    }

    let jmin = exists(amnezia_obj, "jmin") ? amnezia_obj.jmin : null;
    let jmax = exists(amnezia_obj, "jmax") ? amnezia_obj.jmax : null;

    if (jmin != null && (type(jmin) != "int" || jmin < 0 || jmin > 1280))
        return fail("invalid_jmin", "jmin must be an integer between 0 and 1280");

    if (jmax != null && (type(jmax) != "int" || jmax < 0 || jmax > 1280))
        return fail("invalid_jmax", "jmax must be an integer between 0 and 1280");

    if (jmin != null && jmax != null && jmax < jmin)
        return fail("invalid_jmax", "jmax must be greater than or equal to jmin");

    for (let sk in [ "s1", "s2", "s3", "s4" ]) {
        if (exists(amnezia_obj, sk)) {
            let sv = amnezia_obj[sk];
            if (type(sv) != "int" || sv < 0 || sv > 1280)
                return fail("invalid_" + sk, sk + " must be an integer between 0 and 1280");
        }
    }

    let header_ranges = [];
    for (let hk in [ "h1", "h2", "h3", "h4" ]) {
        if (!exists(amnezia_obj, hk))
            continue;
        let parsed = parse_header_range(amnezia_obj[hk]);
        if (parsed == null)
            return fail("invalid_" + hk, hk + " must be a 32-bit unsigned integer or min-max range");
        parsed.key = hk;
        for (let prev in header_ranges) {
            if (!(parsed.max < prev.min || prev.max < parsed.min))
                return fail("overlapping_header_ranges", prev.key + " and " + hk + " ranges must not overlap");
        }
        push(header_ranges, parsed);
    }

    for (let ik in [ "i1", "i2", "i3", "i4", "i5" ]) {
        if (!exists(amnezia_obj, ik))
            continue;
        let iv = amnezia_obj[ik];
        if (type(iv) != "string" || trim(iv) == "" || length(iv) > 4096 || index(iv, "\n") >= 0 || index(iv, "\r") >= 0)
            return fail("invalid_" + ik, ik + " must be a non-empty single-line CPS signature string");
    }

    return { valid: true };
}

return {
    ONE_SIDED_KEYS,
    TWO_SIDED_KEYS,
    ALL_KEYS,
    default_one_sided_preset,
    normalize,
    is_two_sided,
    validate
};
