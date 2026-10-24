// Trusted Extended REALITY capability adapter. GPL-2.0-or-later.
let fs = require('fs');

function object(value) { return type(value) == 'object' ? value : {}; }
function array(value) { return type(value) == 'array' ? value : []; }
function quote(value) { return "'" + replace(value, /'/g, "'\\''") + "'"; }
function output(command, limit) {
    let pipe = fs.popen(command + ' 2>/dev/null', 'r');
    if (!pipe) return '';
    let text = pipe.read(limit), status = pipe.close();
    return status == 0 ? trim(text || '') : '';
}
function runtime_binary() {
    return getenv('FORKOP_SINGBOX_BINARY') || output('command -v sing-box', 4096);
}
function runtime_version() {
    let binary = runtime_binary();
    if (!binary) return '';
    let found = match(output(quote(binary) + ' version', 4096), /sing-box version ([0-9][0-9A-Za-z.+_-]*)/);
    return found ? found[1] : '';
}
function verified_runtime(version, binary_path) {
    let path = (getenv('FORKOP_LIB') || '/usr/lib/forkop') + '/singbox/validated-cores.json';
    let stat = fs.stat(path);
    if (!stat || stat.size > 131072) return null;
    let manifest;
    try { manifest = json(fs.readfile(path)); } catch (e) { return null; }
    if (object(manifest).schema != 1) return null;
    let candidates = [];
    for (let profile in array(manifest.cores))
        if (object(profile).version == version && profile.reality_hybrid === true)
            push(candidates, profile);
    if (!length(candidates)) return null;
    let binary = binary_path || runtime_binary();
    if (!binary || !fs.stat(binary)) return null;
    // Hash the selected executable; its displayed suffix cannot admit a core.
    let digest = match(output('sha256sum ' + quote(binary), 8192), /^([0-9a-f]{64})[ \t]/);
    if (!digest) return null;
    for (let profile in candidates)
        if (profile.sha256 == digest[1]) return profile;
    return null;
}
function supported_outbound(outbound, profile) {
    let tls = object(object(outbound).tls), reality = object(tls.reality), utls = object(tls.utls);
    return profile != null && tls.enabled === true && reality.enabled === true &&
        utls.enabled === true && utls.fingerprint == 'chrome' &&
        index(array(profile.fingerprints), utls.fingerprint) >= 0;
}
function record_fragment_supported(outbound, profile) {
    return supported_outbound(outbound, profile) &&
        object(profile).reality_record_fragment === true;
}
function record_fragment_error(outbound, profile) {
    let reality = object(object(object(outbound).tls).reality);
    if (index(keys(reality), 'record_fragment_size') < 0) return '';
    let size = reality.record_fragment_size;
    if (type(size) != 'int' || size < 0 || size > 16384)
        return 'tls.reality.record_fragment_size must be an integer from 0 to 16384';
    if (object(profile).reality_record_fragment !== true)
        return 'tls.reality.record_fragment_size requires an exactly verified record-fragment core';
    return '';
}
function adapt_outbound(outbound, profile) {
    let error = record_fragment_error(outbound, profile);
    if (error != '') die(error);
    if (supported_outbound(outbound, profile) &&
        index(keys(outbound.tls.reality), 'support_x25519mlkem768') < 0)
        outbound.tls.reality.support_x25519mlkem768 = true;
    if (record_fragment_supported(outbound, profile) &&
        index(keys(outbound.tls.reality), 'record_fragment_size') < 0)
        outbound.tls.reality.record_fragment_size = 256;
    return outbound;
}
function hybrid_enabled(outbound, profile) {
    return supported_outbound(outbound, profile) &&
        outbound.tls.reality.support_x25519mlkem768 === true;
}
return {runtime_binary, runtime_version, verified_runtime, supported_outbound, record_fragment_supported, record_fragment_error, adapt_outbound, hybrid_enabled};
