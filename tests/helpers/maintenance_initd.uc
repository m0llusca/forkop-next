let scenario=ARGV[0],events=[],command_index=-1;
restore_dnsmasq_failsafe=function(){push(events,'failsafe');return 0;};
begin_external_service_action=function(){return 'fixture';};
finish_external_service_action=function(){return 0;};
file_executable=function(){return scenario!='missing'&&scenario!='restart-missing';};
uci_settings=function(){return {shutdown_correctly:'0'};};
clear_start_retry=function(){};
cancel_scheduled_start_retry=function(){};
mark_start_retry=function(path,reason){push(events,'retry-mark:'+reason);return true;};
schedule_start_retry=function(){push(events,'retry-schedule');return true;};
command_success_from_args=function(){return true;};
command_status_from_args=function(args){
    command_index=length(events);
    push(events,join('|',args));
    return scenario=='start-failure'||scenario=='stop-failure'||scenario=='restart-failure'?9:0;
};
let status=index(scenario,'restart')==0?restart_service('123'):
    scenario=='stop-failure'?stop_service('123','maintenance'):start_service(scenario=='ordinary'?'':'maintenance','123');
let failsafe=index(events,'failsafe')>=0;
if(scenario=='restart-failure') {
    if(status!=9||!failsafe||index(events,'failsafe')<=command_index)die('FAIL: failed restart must retain its error and restore DNS');
    if(index(events,'retry-mark:restart_failed')<0||index(events,'retry-schedule')<0)die('FAIL: failed restart lost automatic start retry');
}
else if(scenario=='restart') {
    if(status!=0||failsafe||index(events,'retry-schedule')>=0||index(events,BIN_PATH+'|restart')<0)die('FAIL: successful restart must not schedule recovery');
}
else if(scenario=='restart-missing') {
    if(status==0||!failsafe||index(events,'retry-schedule')>=0)die('FAIL: missing restart executable must retain existing fail-safe without retry');
}
else if(scenario=='maintenance') {
    if(status!=0||failsafe||index(events,BIN_PATH+'|start|maintenance')<0)die('FAIL: initd maintenance must propagate reason without DNS reset');
}
else if(scenario=='ordinary') {
    if(!failsafe)die('FAIL: stale upgrade state must not bypass ordinary recovery');
}
else if(status==0||!failsafe||index(events,'failsafe')<=command_index)die('FAIL: initd '+scenario+' must fail safely after the failed command');
print('PASS: initd ',scenario,'\n');
