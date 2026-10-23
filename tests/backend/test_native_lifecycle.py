"""The real lifecycle must call transactions before touching router runtime."""
import json, os, shutil, subprocess, tempfile, unittest
from pathlib import Path
from test_next_profiles import LIB

class NativeLifecycle(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.dir=Path(self.temp.name);self.lib=self.dir/'lib';shutil.copytree(LIB,self.lib)
        self.event=self.dir/'event'
        self.env=dict(os.environ,FORKOP_LIB=str(self.lib),FORKOP_RUNTIME_STATE_DIR=str(self.dir/'run'),FORKOP_CONFIG_FILE=str(self.dir/'forkop'),FORKOP_TEST_EVENT=str(self.event))

    def test_native_reload_delegates_to_transaction_before_runtime_mutation(self):
        (self.lib/'service/next.uc').write_text('let fs=require("fs");fs.writefile(getenv("FORKOP_TEST_EVENT"),ARGV[1]);print(sprintf("%J",{success:true,data:{}}));')
        run=subprocess.run(['ucode','-L',str(self.lib),str(self.lib/'service/lifecycle.uc'),'reload'],env=self.env,capture_output=True,text=True,timeout=15)
        self.assertEqual(run.returncode,0,run.stdout+run.stderr)
        self.assertEqual(self.event.read_text(),'native_apply')

    def selector_restart(self, changed_identity):
        """Run actual lifecycle capture/restore with a fixture diagnostics adapter.

        The test driver replaces only lifecycle's CLI dispatcher, keeping its
        production functions intact and avoiding any router runtime actions.
        """
        config = self.dir / 'sing-box.json'
        candidate = self.dir / 'candidate.json'
        phase = self.dir / 'phase'
        calls = self.dir / 'selector-calls'
        before = {'outbounds': [
            {'type': 'selector', 'tag': 'main-out', 'outbounds': ['a', 'b'], 'default': 'a'},
            {'type': 'vless', 'tag': 'a', 'server': 'first.example', 'server_port': 443, 'uuid': 'first'},
            {'type': 'vless', 'tag': 'b', 'server': 'second.example', 'server_port': 443, 'uuid': 'second'},
        ]}
        after = json.loads(json.dumps(before))
        if changed_identity:
            after['outbounds'][2]['server'] = 'different.example'
        config.write_text(json.dumps(before))
        candidate.write_text(json.dumps(after))
        state = self.dir / 'state'
        state.write_text('forkop.settings=settings\nforkop.settings.config_path=' + str(config) + '\n')
        self.env.update(FORKOP_UCI_STATE_FILE=str(state), FORKOP_SELECTION_FILE=str(self.dir / 'choices.json'),
                        FORKOP_TEST_PHASE=str(phase), FORKOP_TEST_SELECTOR_CALLS=str(calls))
        (self.lib / 'diagnostics/runtime.uc').write_text('''
let fs=require('fs');
if(ARGV[1]=='get_proxies') {
    let selected=fs.stat(getenv('FORKOP_TEST_PHASE'))?'a':'b';
    print(sprintf('%J',{proxies:{'main-out':{type:'Selector',now:selected,all:['a','b']}}}));
}
else if(ARGV[1]=='set_group_proxy')
    fs.writefile(getenv('FORKOP_TEST_SELECTOR_CALLS'),sprintf('%J',{group:ARGV[2],proxy:ARGV[3]}));
''')
        source = (self.lib / 'service/lifecycle.uc').read_text()
        functions = source.split('let mode = ARGV[0] || "";', 1)[0]
        driver = self.dir / 'selector-restart.uc'
        driver.write_text(functions + '''
let before=json(fs.readfile(ARGV[0]));
require('service.selection').remember('main-out','b',before,'manual');
let snapshot=capture_selector_state();
if(ARGV[2]=='changed') {
    let after=json(fs.readfile(ARGV[1]));
    require('service.selection').apply(after);
    fs.writefile(ARGV[0],sprintf('%J',after));
}
fs.writefile(getenv('FORKOP_TEST_PHASE'),'after');
restore_selector_state(snapshot);
''')
        run = subprocess.run(['ucode', '-L', str(self.lib), str(driver), str(config), str(candidate),
                              'changed' if changed_identity else 'unchanged'], env=self.env,
                             capture_output=True, text=True, timeout=15)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        return json.loads(calls.read_text()) if calls.exists() else None

    def test_restart_does_not_restore_reused_tag_for_different_server(self):
        self.assertIsNone(self.selector_restart(changed_identity=True))

    def test_restart_preserves_runtime_selection_when_generated_config_is_unchanged(self):
        self.assertEqual(self.selector_restart(changed_identity=False), {'group': 'main-out', 'proxy': 'b'})
