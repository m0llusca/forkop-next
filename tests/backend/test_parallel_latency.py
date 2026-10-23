import json,os,pathlib,subprocess,tempfile,threading,time,unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parents[2];LIB=ROOT/'forkop/files/usr/lib'

class LatencyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.active=0;self.maximum=0;self.bad=False;self.slow=False;self.lock=threading.Lock();owner=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                if self.path=='/proxies':data={'proxies':{f'node-{i}':{'type':'VLESS'} for i in range(8)}}
                else:
                    with owner.lock:owner.active+=1;owner.maximum=max(owner.maximum,owner.active)
                    try:time.sleep(1 if owner.slow else .12)
                    finally:
                        with owner.lock:owner.active-=1
                    data={'message':'timeout'} if owner.bad and '/node-2/' in self.path else {'delay':12}
                body=json.dumps(data).encode();self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers()
                try:self.wfile.write(body)
                except (BrokenPipeError,ConnectionResetError):pass
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=self.server.serve_forever,daemon=True).start()
        state=pathlib.Path(self.tmp.name)/'state';state.write_text('forkop.settings=settings\nforkop.settings.service_listen_address=127.0.0.1\n')
        self.env=dict(os.environ,FORKOP_LIB=str(LIB),FORKOP_UCI_STATE_FILE=str(state),SB_CLASH_API_CONTROLLER_PORT=str(self.server.server_port),TMP_SING_BOX_FOLDER=self.tmp.name)

    def tearDown(self):self.server.shutdown();self.server.server_close();self.tmp.cleanup()
    def run_check(self,timeout='5000'):
        return subprocess.run(['ucode','-L',str(LIB),str(LIB/'diagnostics/runtime.uc'),'clash-api','get_proxy_latencies',json.dumps([f'node-{i}' for i in range(8)]),timeout],env=self.env,text=True,capture_output=True,timeout=20)
    def test_latency_checks_overlap_with_a_bounded_worker_count(self):
        r=self.run_check();self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(json.loads(r.stdout)['count'],8)
        self.assertGreater(self.maximum,1,'latency checks still run serially')
        self.assertLessEqual(self.maximum,4,'router request concurrency exceeded 4')
    def test_json_error_response_is_a_failed_probe(self):
        self.bad=True;r=self.run_check()
        self.assertFalse(json.loads(r.stdout)['success'],'valid JSON is not proof of a successful delay measurement')
        self.assertNotEqual(r.returncode,0)
    def test_network_timeout_bounds_actual_request_not_only_api_parameter(self):
        self.slow=True;started=time.monotonic();r=self.run_check('100')
        self.assertLess(time.monotonic()-started,2.5,'curl request was not bounded')
        self.assertFalse(json.loads(r.stdout)['success'])

if __name__=='__main__':unittest.main()
