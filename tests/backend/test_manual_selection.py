"""Manual preferences persist by connection identity, not reused display tags."""
import json, os, subprocess, tempfile, unittest
from pathlib import Path
from test_next_profiles import LIB

class ManualSelection(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'choices.json'
        self.env=dict(os.environ,FORKOP_SELECTION_FILE=str(self.path))
        self.config={'outbounds':[{'type':'selector','tag':'main-out','outbounds':['a','b'],'default':'a'},
                                  {'type':'vless','tag':'a','server':'first.example','server_port':443,'uuid':'first'},
                                  {'type':'vless','tag':'b','server':'second.example','server_port':443,'uuid':'second'}]}

    def call(self,action,config=None,origin='manual'):
        code='let fs=require("fs");let s=fs.stat(ARGV[0]+"/service/selection.uc")?require("service.selection"):null;let c=json(ARGV[2]);let result=s?(ARGV[1]=="remember"?s.remember("main-out","b",c,ARGV[3]):s.apply(c)):{success:false};print(sprintf("%J",result));'
        run=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB),action,json.dumps(config or self.config),origin],env=self.env,capture_output=True,text=True)
        self.assertEqual(run.returncode,0,run.stderr)
        return json.loads(run.stdout)

    def test_manual_choice_survives_new_process_and_server_rename(self):
        self.assertTrue(self.call('remember')['success'])
        new=json.loads(json.dumps(self.config));new['outbounds'][0]['outbounds']=['a','renamed'];new['outbounds'][2]['tag']='renamed'
        self.assertEqual(self.call('apply',new)['outbounds'][0]['default'],'renamed')
        self.assertNotIn('uuid',self.path.read_text())

    def test_reused_tag_never_selects_a_different_server(self):
        self.assertTrue(self.call('remember')['success'])
        new=json.loads(json.dumps(self.config));new['outbounds'][2]['server']='different.example'
        self.assertEqual(self.call('apply',new)['outbounds'][0]['default'],'a')

    def test_automatic_selection_does_not_write_flash(self):
        self.assertTrue(self.call('remember',origin='automatic')['success'])
        self.assertFalse(self.path.exists())

    def test_real_manual_api_call_saves_preference_after_success(self):
        import threading
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_PUT(self):
                self.rfile.read(int(self.headers.get('Content-Length', 0)))
                self.send_response(204)
                self.end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',0), Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        config=Path(self.temp.name)/'config.json';config.write_text(json.dumps(self.config))
        state=Path(self.temp.name)/'state';state.write_text('forkop.settings=settings\nforkop.settings.config_path='+str(config)+'\nforkop.settings.service_listen_address=127.0.0.1\n')
        env=dict(self.env,FORKOP_LIB=str(LIB),FORKOP_UCI_STATE_FILE=str(state),SB_CLASH_API_CONTROLLER_PORT=str(server.server_port))
        run=subprocess.run(['ucode','-L',str(LIB),str(LIB/'diagnostics/runtime.uc'),'clash-api','set_group_proxy','main-out','b'],env=env,capture_output=True,text=True)
        self.assertEqual(run.returncode,0,run.stderr)
        self.assertTrue(self.path.exists(), 'successful manual API selection must persist')
