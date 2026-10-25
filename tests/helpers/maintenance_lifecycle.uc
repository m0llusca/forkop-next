// Appended to production lifecycle functions; no dispatcher or live services.
let scenario = ARGV[0], events = [], clean = '0';
log_message = function(message, level) {};
module_status = function(path, args) {
    if (args[0] == 'wait-forkop-stable-start' || args[0] == 'forkop-stably-running') {
        push(events, 'verify');
        return scenario == 'unstable-start' || scenario == 'maintenance-start-unstable' ? 7 : 0;
    }
    return 0;
};
module_success = function(path, args) { return module_status(path, args) == 0; };
module_output = function(path, args) { return ''; };
module_background = function(path, args) { return true; };
command_success_from_args = function(args) {
    // Only the production ruleset cleanup may execute in this temporary fixture.
    if (args[0] == 'find' && args[1] == TMP_RULESET_FOLDER)
        return system(command_from_args(args)) == 0;
    return false;
};
command_status_from_args = function(args) {
    if (args[0] == '/etc/init.d/sing-box' && args[1] == 'stop') {
        push(events, 'core-stop');
        return scenario == 'stop-failure' || scenario == 'restart-stop-failure' ? 6 : 0;
    }
    die('Unexpected external command: ' + sprintf('%J', args));
};
remove_cron_jobs = function() {};
setting_bool = function(name, fallback) { return false; };
dnsmasq_restore = function(force) { push(events, 'dns-restore'); return 0; };
dnsmasq_restore_fail_safe = function() { push(events, 'dns-failsafe'); return 0; };
dnsmasq_configure = function(force) { push(events, 'dns-configure'); return 0; };
config_set = function(path, value) { clean = value; return true; };
config_commit = function() { return 0; };
capture_selector_state = function() { push(events, 'capture'); return {config_hash:'fixture',selections:{main:'b'}}; };
restore_selector_state = function(snapshot) { if (snapshot.selections.main != 'b') die('lost selector'); push(events, 'restore-selector'); };
start_main = function() { push(events, 'core-start'); return scenario == 'start-failure' || scenario == 'maintenance-start-failure' ? 5 : 0; };
release_start_subscription_update_lock = function() {};
mark_pending_reload_if_config_changed = function() { return false; };
let status;
fs.writefile(PACKAGE_UPGRADE_STATE,sprintf('%J',{version:1,selector_state:{config_hash:'fixture',selections:{main:'b'}}}));
fs.chmod(PACKAGE_UPGRADE_STATE,384);
if (scenario == 'stop') status = stop();
else if (scenario == 'maintenance-stop' || scenario == 'stop-failure') status = stop('maintenance');
else if (scenario == 'ordinary-start') status = start();
else if (index(scenario,'maintenance-start') == 0) status = start('maintenance');
else status = restart();
let restored = index(events, 'dns-restore') >= 0;
let failed_safe = index(events, 'dns-failsafe') >= 0;
if (scenario == 'stop') {
    if (status != 0 || !restored || clean != '1' || fs.stat(PACKAGE_UPGRADE_STATE)) die('FAIL: ordinary Stop must restore DNS, mark clean and clear stale resume state');
}
else if (scenario == 'ordinary-start') {
    if (status != 0 || index(events,'restore-selector') >= 0) die('FAIL: ordinary start consumed maintenance snapshot');
}
else if (scenario == 'maintenance-stop' || scenario == 'restart' || scenario == 'maintenance-start') {
    if (status != 0 || restored || failed_safe || clean != '0') die('FAIL: ' + scenario + ' must preserve DNS and unclean recovery flag');
    if (scenario != 'maintenance-stop' && (index(events, 'restore-selector') < 0 || index(events, 'verify') < 0)) die('FAIL: restart/start lost verified selector restoration');
}
else if (status == 0 || !failed_safe) die('FAIL: ' + scenario + ' must return failure and restore DNS failsafe');
print('PASS: ', scenario, '\n');
