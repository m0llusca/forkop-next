// Read-only component impact. GPL-2.0-or-later. No installer imports or network.
let fs = require('fs');
let reality = require('singbox.reality');
function object(value) { return type(value) == 'object' ? value : {}; }
function bounded(path, limit) {
    let stat = fs.stat(path);
    return stat && stat.size <= limit ? fs.readfile(path) : null;
}
function marker(path, allowed, fallback) {
    let raw = bounded(path, 128), value = raw == null ? '' : trim(raw);
    return index(allowed, value) >= 0 ? value : fallback;
}
function requirements() {
    let unavailable = {basis:'unavailable',reality:null,record_fragment:null};
    let path = getenv('FORKOP_SINGBOX_CONFIG');
    if (!path) path = require('core.uci').get(getenv('FORKOP_CONFIG_NAME') || 'forkop', 'settings', 'config_path') || '/etc/sing-box/config.json';
    let raw = bounded(path, 1048576), config;
    try { config = object(json(raw)); } catch (e) { return unavailable; }
    if (type(config.outbounds) != 'array' || length(config.outbounds) > 2000) return unavailable;
    let result = {basis:'generated_config',reality:0,record_fragment:0};
    for (let out in config.outbounds) {
        let r = object(object(object(out).tls).reality);
        if (r.enabled === true) result.reality++;
        if (index(keys(r), 'record_fragment_size') >= 0) result.record_fragment++;
    }
    return result;
}
function preview(raw) {
    if (type(raw) != 'string' || length(raw) > 4096) return {success:false,error:'invalid_request'};
    let request;
    try { request = json(raw); } catch (e) { return {success:false,error:'invalid_request'}; }
    if (type(request) != 'object' || length(keys(request)) != 2 ||
        index(['forkop','sing_box','zapret','zapret2','byedpi'], request.component) < 0)
        return {success:false,error:'invalid_request'};
    let actions = request.component == 'sing_box' ? ['install','install_extended','install_extended_compressed','install_stable','install_tiny','install_forkop_record_compressed'] :
        request.component == 'forkop' ? ['install'] : ['install','remove'];
    if (index(actions, request.action) < 0) return {success:false,error:'invalid_request'};
    let current = {version:null,variant:null,source:null,runtime_source:null,admission:'unknown',sha256:null,capabilities:null};
    let target = {variant:request.action == 'remove' ? 'removed' : null,source:'official',admission:'unverified',capabilities:null};
    let required = {basis:'unavailable',reality:null,record_fragment:null};
    if (request.component == 'sing_box') {
        current.version = reality.runtime_version() || null;
        current.variant = marker(getenv('SB_VARIANT_STATE_FILE') || '/etc/forkop/sing-box-variant', ['stable','tiny','extended','extended-compressed'], null);
        current.source = marker(getenv('SB_SOURCE_STATE_FILE') || '/etc/forkop/sing-box-source', ['','forkop-next-record'], null);
        if (current.source == '') current.source = 'official';
        let profile = reality.verified_runtime(current.version);
        if (profile) {
            current.admission = 'admitted';
            current.sha256 = profile.sha256;
            current.runtime_source = profile.source == 'forkop-next-record' ? profile.source : 'official';
            current.capabilities = {reality_hybrid:profile.reality_hybrid === true,reality_record_fragment:profile.reality_record_fragment === true};
        }
        target.variant = request.action == 'install' ? current.variant : request.action == 'install_stable' ? 'stable' : request.action == 'install_tiny' ? 'tiny' : request.action == 'install_extended' ? 'extended' : 'extended-compressed';
        target.source = request.action == 'install' ? current.source : request.action == 'install_forkop_record_compressed' ? 'forkop-next-record' : 'official';
        required = requirements();
    }
    return {success:true,data:{component:request.component,action:request.action,captured_at:time(),current,target,requirements:required,
        restart_expected:true,recovery:request.component == 'sing_box' ? 'sing_box_transaction' : 'manual',connectivity_tested:false}};
}
print(sprintf('%J\n', ARGV[0] == 'preview' ? preview(ARGV[1]) : {success:false,error:'invalid_command'}));
