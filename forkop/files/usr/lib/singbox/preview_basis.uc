// Captures the exact source bytes consumed by generation, once per pathname.
let fs = require('fs');
let sha = require('core.sha256').digest;
let common = require('core.common');
let captured = null;
function begin() { captured = {}; }
function read(path) {
    if (captured != null && index(keys(captured),path)>=0) return captured[path];
    let value=fs.readfile(path);
    if(captured!=null) captured[path]=value;
    return value;
}
function digest(value) { return value==null?'missing':sha(value); }
function source_records() {
    let result=[];
    for(let path,value in captured || {}) push(result,{path,digest:digest(value)});
    return result;
}
function core_identity() {
    // This identity read never executes the core. Paths come from the backend.
    let binary=getenv('FORKOP_SINGBOX_BINARY') || '/usr/bin/sing-box';
    let quote=function(value){return "'"+replace(value,/'/g,"'\\''")+"'";};
    let info=fs.stat(binary), binary_digest='missing';
    if(info) {
        let pipe=fs.popen('sha256sum '+quote(binary)+' 2>/dev/null','r');
        let value=pipe?pipe.read(128):'', status=pipe?pipe.close():1;
        let matched=status==0?match(value,/^([0-9a-f]{64})[ \t]/):null;
        if(!matched) return null;
        binary_digest=matched[1];
    }
    let trust=(getenv('FORKOP_LIB') || '/usr/lib/forkop')+'/singbox/validated-cores.json';
    return sha(sprintf('%J',[binary_digest,digest(fs.readfile(trust))]));
}
function config_snapshot() {
    let fixture=getenv('FORKOP_PREVIEW_CONFIG_FIXTURE');
    if(fixture) { let raw=fs.readfile(fixture);return {data:json(raw),rawDigest:sha(raw)}; }
    let uci=require('core.uci'), data={};
    for(let kind in ['settings','server','section','subscription_url','section_interface','urltest','priority_group','priority_level'])
        data[kind]=uci.section_objects('forkop',kind);
    let raw=fs.readfile(getenv('FORKOP_UCI_STATE_FILE') || '/etc/config/forkop');
    return {data,rawDigest:digest(raw)};
}
function stamp(snapshot, core, supports_xhttp) {
    let records=source_records();
    // A completed stamp describes captured inputs; the read API separately checks
    // that each backend pathname still identifies those exact bytes.
    return {schema:1,resolverSchema:1,complete:true,configDigest:sha(sprintf('%J',snapshot.data)),
        rawDigest:snapshot.rawDigest,sourceFiles:records,coreDigest:core,supportsXhttp:supports_xhttp};
}
function verify(basis,snapshot) {
    if(type(basis)!='object'||basis.schema!=1||basis.resolverSchema!=1||basis.complete!==true) return false;
    if(basis.configDigest!=sha(sprintf('%J',snapshot.data))||basis.rawDigest!=snapshot.rawDigest||basis.coreDigest!=core_identity()) return false;
    let folder=getenv('TMP_SUBSCRIPTION_FOLDER') || '/tmp/sing-box/subscriptions';
    for(let record in common.array_or_empty(basis.sourceFiles)) {
        // Never accept caller-selected paths. Cache paths remain backend-private.
        if(index(record.path,folder+'/')!=0||match(substr(record.path,length(folder)+1),/^[A-Za-z0-9_-]+\.(json|url|user_agent|hwid)$/)==null) return false;
        if(record.digest!=digest(fs.readfile(record.path))) return false;
    }
    return true;
}
return {begin,read,digest,source_records,core_identity,config_snapshot,stamp,verify};
