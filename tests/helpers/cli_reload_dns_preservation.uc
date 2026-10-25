// Injected between production lifecycle functions and their real dispatcher.
// The public CLI, validation, Next preflight/lock, DNS apply and file-backed
// core.uci writes stay real. Hardware/service operations are closed boundaries.
let scenario = getenv('FORKOP_CLI_DNS_SCENARIO');
let actual_module_status = module_status;
let actual_module_output = module_output;
function fixture_event(value) {
    let path=getenv('FORKOP_CLI_DNS_EVENTS');
    fs.writefile(path,(fs.readfile(path)||'')+value+'\n');
}
module_status = function(path,args) {
    if(path==VALIDATOR_UC && args[0]=='check-requirements') return 0;
    if(path==SERVER_UC && args[0]=='prepare-all-defaults') return 0;
    if(path==VALIDATOR_UC && args[0]=='validate-runtime') return actual_module_status(path,args);
    if(path==DNS_APPLY_UC) return actual_module_status(path,args);
    if(path==STATE_UC && args[0]=='clear-reload-state') return actual_module_status(path,args);
    if(path==NFT_UC && index(args[0],'tproxy-')==0) return 1;
    if(index(['stop-runtime','stop-deferred-bootstrap-worker','stop-list-update','remove-cron-jobs'],args[0])>=0) return 0;
    die('Unexpected module boundary: '+path+' '+sprintf('%J',args));
};
module_output = function(path,args) {
    let value=actual_module_output(path,args);
    if(path==LIB_DIR+'/service/next.uc') fs.writefile(getenv('FORKOP_CLI_DNS_NEXT_RESULT'),value);
    return value;
};
command_success_from_args = function(args) {
    if(args[0]=='logger') return true;
    if(args[0]=='nft' && args[1]=='list') return false;
    if(args[0]=='find' && args[1]==TMP_RULESET_FOLDER) return system(command_from_args(args))==0;
    die('Unexpected external command: '+sprintf('%J',args));
};
command_status_from_args = function(args) {
    if(args[0]=='/etc/init.d/sing-box' && args[1]=='stop') {
        fs.unlink(getenv('FORKOP_CLI_DNS_RUNTIME'));
        fixture_event('core-stop');
        return 0;
    }
    die('Unexpected external service: '+sprintf('%J',args));
};
let next_lock=null;
if(scenario=='next-busy') {
    next_lock=fs.open(getenv('FORKOP_NEXT_DIR')+'/operation.lock','ae',384);
    if(!next_lock || !next_lock.lock('xn')) die('Unable to hold the real Next operation lock');
}
if(scenario=='mutated-failure' || scenario=='cleanup-retry') {
    // Simulate the external nft/configuration boundary having already failed;
    // production abort_reload owns all subsequent cleanup and real DNS writes.
    reload_tracked=function(reason) { return abort_reload(37,true); };
}
else if(scenario=='mismatched-ack') {
    reload_tracked=function(reason) {
        acknowledge_reload_result(99);
        return 1;
    };
}
else if(scenario=='crash-after-stop') {
    reload_tracked=function(reason) {
        let stopped=stop_main();
        if(stopped!=0) die('fixture stop failed before crash injection');
        die('fixture unexpected reload failure after stop');
    };
}
// The real production dispatcher follows, including normal acknowledgement,
// release and exit. Process exit also closes next_lock.
