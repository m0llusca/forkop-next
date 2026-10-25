#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FORKOP_LIB="$ROOT_DIR/forkop/files/usr/lib"

command -v ucode >/dev/null 2>&1 || {
  printf 'FAIL: native ucode is required for SHA256 checks\n' >&2
  exit 1
}

ucode -L "$FORKOP_LIB" -e "$(cat <<'UCODE'
let native = require("digest");
assert(type(native.sha256) == "function", "native digest module must provide SHA256");

// Literal expectations were derived independently from the production module.
let all_bytes = "";
for (let i = 0; i < 256; i++) all_bytes += chr(i);
let vectors = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["first" + chr(0) + "last", "ca926364f0d61f92894a8633893650aaffd2b29cfda636e7fbd075b44a6353d2"],
    ["Привет 🌍", "d415d2646823ba3dd5ca460a26bd0e0cc066770bbdff46c7517bf70336b01fde"],
    [all_bytes, "40aff2e9d2d8922e47afd4648e6967497158785fbd1da870e7110266bf944880"]
];
function check_vectors(module, label) {
    for (let vector in vectors)
        assert(module.digest(vector[0]) == vector[1], label + ": wrong digest for exact input bytes");
}

// Exercise the real module boundary; the spy delegates to the actual native hash.
let calls = [];
modules["digest"] = {sha256: function(value) {
    push(calls, value);
    return native.sha256(value);
}};
let tested = require("core.sha256");
for (let vector in vectors) {
    let before = length(calls);
    assert(tested.digest(vector[0]) == vector[1], "native path must return the expected SHA256");
    assert(length(calls) == before + 1, "digest must call native SHA256 exactly once per input");
    assert(calls[before] === vector[0], "native SHA256 must receive the unchanged bytes");
}

// Replacing the loader cache must not change an already selected native function.
modules["digest"] = {sha256: function() { die("digest module was loaded again"); }};
let before = length(calls);
assert(tested.digest("abc") == vectors[1][1], "native selection must remain cached");
assert(length(calls) == before + 1, "cached native function must still receive the input");

// Remove every native search location: this is a real module-not-found fallback.
delete modules["core.sha256"];
delete modules["digest"];
let original_paths = REQUIRE_SEARCH_PATH;
REQUIRE_SEARCH_PATH = [ARGV[0] + "/*.uc"];
let absent = false;
try { require("digest"); } catch (e) { absent = true; }
assert(absent, "missing-module fixture must exclude the native module");
let fallback = require("core.sha256");
REQUIRE_SEARCH_PATH = original_paths;
check_vectors(fallback, "missing native module");

// The unavailable-module decision is cached too, rather than probing on each hash.
let probes = 0;
modules["digest"] = {sha256: function(value) { probes++; return native.sha256(value); }};
check_vectors(fallback, "cached missing native module");
assert(probes == 0, "missing native module must not be probed on each digest");

let fallback_cases = [
    {name: "missing SHA256 export", module: {}},
    {name: "noncallable SHA256 export", module: {sha256: 42}},
    {name: "native exception", module: {sha256: function() { die("synthetic native failure"); }}},
    {name: "null native result", module: {sha256: function() { return null; }}},
    {name: "nonstring native result", module: {sha256: function() { return {}; }}},
    {name: "empty native result", module: {sha256: function() { return ""; }}},
    {name: "short native result", module: {sha256: function() { return "abc"; }}},
    {name: "nonhex native result", module: {sha256: function() {
        return "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg";
    }}},
    {name: "uppercase native result", module: {sha256: function() {
        return "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    }}}
];
for (let fixture in fallback_cases) {
    delete modules["core.sha256"];
    modules["digest"] = fixture.module;
    check_vectors(require("core.sha256"), fixture.name);
}

print("SHA256 native delegation and fallback checks passed\n");
UCODE
)" "$FORKOP_LIB"
