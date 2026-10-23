import json,os,pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];LIB=ROOT/'forkop/files/usr/lib'
class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();d=pathlib.Path(self.tmp.name);(d/'curl').write_text('#!/usr/bin/env python3\nimport os,sys\nprint(os.environ.get("PROBE_RESPONSE",\'{"http_status":200,"duration":0.125,"remote_ip":"203.0.113.10"}\'))\nsys.exit(int(os.environ.get("PROBE_EXIT","0")))\n');(d/'curl').chmod(0o755)
        (d/'state').write_text('forkop.settings=settings\nforkop.main=section\nforkop.main.action=connection\n')
        self.env=dict(os.environ,PATH=str(d)+':'+os.environ['PATH'],FORKOP_UCI_STATE_FILE=str(d/'state'))
    def tearDown(self):self.tmp.cleanup()
    def call(self,payload):
        code='let fs=require("fs"); let result=fs.stat(ARGV[0]+"/service/probe.uc")?require("service.probe").handle(json(ARGV[1])):{success:false,error:"feature_unavailable"}; print(sprintf("%J",result));'
        r=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB),json.dumps(payload)],env=self.env,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr);return json.loads(r.stdout)
    def test_network_response_is_reported_without_claiming_application_login(self):
        r=self.call({'domain':'example.org'});self.assertTrue(r['success'],r)
        self.assertTrue(r['data']['reachable']);self.assertEqual(r['data']['http_status'],200)
        self.assertEqual(r['data']['duration_ms'],125);self.assertEqual(r['data']['limitation'],'network_probe_only')
    def test_tls_failure_is_a_completed_unsuccessful_probe(self):
        self.env['PROBE_EXIT']='60';r=self.call({'domain':'example.org'});self.assertTrue(r['success'],r)
        self.assertFalse(r['data']['reachable']);self.assertEqual(r['data']['curl_status'],60)
    def test_http_forbidden_is_network_reachable_with_status_preserved(self):
        self.env['PROBE_RESPONSE']='{"http_status":403,"duration":0.01,"remote_ip":"203.0.113.10"}'
        r=self.call({'domain':'example.org'});self.assertTrue(r['success'],r)
        self.assertTrue(r['data']['reachable']);self.assertEqual(r['data']['http_status'],403)
    def test_section_cannot_silently_fall_back_to_current_route(self):
        r=self.call({'domain':'example.org','section':'main'})
        self.assertEqual(r.get('error'),'section_probe_unavailable')
    def test_section_probe_uses_the_actual_generated_listener_address(self):
        d=pathlib.Path(self.tmp.name)
        (d/'state').write_text('forkop.settings=settings\nforkop.main=section\nforkop.main.mixed_proxy_enabled=1\nforkop.main.mixed_proxy_port=19001\n')
        (d/'config.json').write_text(json.dumps({'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.2','listen_port':19001}]}))
        self.env['FORKOP_SINGBOX_CONFIG']=str(d/'config.json')
        (d/'curl').write_text('#!/usr/bin/env python3\nimport sys\nprint(\'{"http_status":200,"duration":0.1,"remote_ip":"203.0.113.1"}\')\nsys.exit(0 if "socks5h://127.0.0.2:19001" in sys.argv else 7)\n')
        r=self.call({'domain':'example.org','section':'main'})
        self.assertTrue(r['success'],r);self.assertTrue(r['data']['reachable'],'probe dialed an address the generated inbound does not listen on')
    def test_malformed_and_local_targets_are_rejected(self):
        for domain in ['x;reboot.org','127.0.0.1','foo.local','a..org','http://example.org','-bad.org']:
            with self.subTest(domain=domain):self.assertFalse(self.call({'domain':domain})['success'])
if __name__=='__main__':unittest.main()
