"""Behavioral tests: a recommendation never silently mutates routing configuration."""
import json, os, pathlib, subprocess, tempfile, unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'

class SmartDetectTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = dict(os.environ, FORKOP_SMART_DETECT_FILE=self.temp.name+'/recommendations.json', FORKOP_SMART_DETECT_NOW='1000')
        self.config = pathlib.Path(self.temp.name)/'config'
        self.config.write_text('unchanged-private-routing')

    def tearDown(self):
        self.temp.cleanup()

    def call(self, action, payload=None, now=1000):
        env = dict(self.env, FORKOP_SMART_DETECT_NOW=str(now))
        # An unavailable feature is a normal negative response, not an import error.
        code = 'let fs=require("fs"); let p=ARGV[0]+"/service/smart_detect.uc"; let result=fs.stat(p)?require("service.smart_detect").handle(ARGV[1],json(ARGV[2])):{success:false,error:"feature_unavailable"}; print(sprintf("%J",result));'
        run = subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB),action,json.dumps(payload or {})],env=env,text=True,capture_output=True)
        self.assertEqual(run.returncode,0,run.stderr)
        result=json.loads(run.stdout)
        if action=='recommendations': self.assertTrue(result['success'],result)
        return result

    def observe(self,domain='example.org',now=1000,direct=False,proxy=True):
        return self.call('recommendation_record',{'domain':domain,'direct_ok':direct,'proxy_ok':proxy},now)

    def pending(self):
        self.assertTrue(self.observe()['success'])
        self.assertTrue(self.observe(now=1120)['success'])
        return self.call('recommendations',now=1120)['data']['recommendations'][0]

    def test_first_failure_is_observation_not_recommendation(self):
        self.assertTrue(self.observe()['success'])
        self.assertEqual(self.call('recommendations')['data']['recommendations'],[])
        self.assertEqual(self.config.read_text(),'unchanged-private-routing')

    def test_repeated_failure_requires_spacing_and_proxy_success(self):
        self.observe(); self.observe(now=1050)
        self.assertEqual(self.call('recommendations',now=1050)['data']['recommendations'],[])
        item=self.pending()
        self.assertEqual(item['domain'],'example.org')
        self.assertEqual(item['status'],'pending')
        self.assertGreaterEqual(item['observations'],2)

    def test_unavailable_proxy_does_not_generate_recommendation(self):
        self.observe(proxy=False); self.observe(now=1200,proxy=False)
        self.assertEqual(self.call('recommendations',now=1200)['data']['recommendations'],[])

    def test_direct_recovery_clears_evidence(self):
        self.pending(); self.observe(now=1200,direct=True)
        self.assertEqual(self.call('recommendations',now=1200)['data']['recommendations'],[])

    def test_local_ip_bank_and_excluded_domains_are_rejected(self):
        for domain in ['localhost','printer.local','192.168.1.1','127.0.0.1','foo..org','x;id.org','sberbank.ru','ya.ru','example.org.evil/']:
            with self.subTest(domain=domain): self.assertFalse(self.observe(domain)['success'])

    def test_acceptance_requires_current_recommendation_and_valid_section(self):
        self.assertFalse(self.call('recommendation_accept',{'id':'missing','section':'main'})['success'])
        item=self.pending()
        self.assertFalse(self.call('recommendation_accept',{'id':item['id'],'section':'main;reboot'},1120)['success'])
        result=self.call('recommendation_accept',{'id':item['id'],'section':'main'},1120)
        self.assertEqual(result['data']['suggestion'],{'section':'main','domain':'example.org','kind':'domain'})
        self.assertEqual(self.config.read_text(),'unchanged-private-routing')

    def test_dismissal_suppresses_repeat_until_expiration(self):
        item=self.pending()
        self.assertTrue(self.call('recommendation_dismiss',{'id':item['id']},1120)['success'])
        self.observe(now=1250); self.observe(now=1400)
        self.assertEqual(self.call('recommendations',now=1400)['data']['recommendations'],[])

    def test_old_evidence_expires_and_backwards_clock_resets(self):
        self.pending()
        self.assertEqual(self.call('recommendations',now=100000)['data']['recommendations'],[])
        self.observe(now=1000); self.observe(now=900)
        self.assertEqual(self.call('recommendations',now=900)['data']['recommendations'],[])

    def test_explicit_scan_compares_actual_routes_and_records_evidence(self):
        d=pathlib.Path(self.temp.name)
        (d/'curl').write_text('#!/usr/bin/env python3\nimport json,sys\nvia="--proxy" in sys.argv\nprint(json.dumps({"http_status":200 if via else 0,"duration":0.01,"remote_ip":"203.0.113.1"}))\nsys.exit(0 if via else 7)\n')
        (d/'curl').chmod(0o755)
        (d/'uci').write_text('forkop.settings=settings\nforkop.main=section\nforkop.main.action=connection\nforkop.main.mixed_proxy_enabled=1\nforkop.main.mixed_proxy_port=19001\n')
        (d/'config.json').write_text(json.dumps({'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.1','listen_port':19001}]}))
        self.env.update(PATH=str(d)+':'+os.environ['PATH'],FORKOP_UCI_STATE_FILE=str(d/'uci'),FORKOP_SINGBOX_CONFIG=str(d/'config.json'))
        first=self.call('recommendation_scan',{'domain':'example.org','section':'main'})
        self.assertTrue(first['success'],first)
        self.assertFalse(first['data']['current']['reachable'])
        self.assertTrue(first['data']['section']['reachable'])
        second=self.call('recommendation_scan',{'domain':'example.org','section':'main'},1120)
        self.assertTrue(second['success'],second)
        self.assertEqual(len(self.call('recommendations',now=1120)['data']['recommendations']),1)

    def test_background_tick_is_opt_in_and_checks_only_direct_error_candidates(self):
        result=self.call('recommendation_tick')
        self.assertTrue(result['success'],result)
        self.assertFalse(result['data']['enabled'])
        d=pathlib.Path(self.temp.name)
        (d/'curl').write_text('#!/usr/bin/env python3\nimport json,sys\nvia="--proxy" in sys.argv\nprint(json.dumps({"http_status":200 if via else 0,"duration":0.01,"remote_ip":"203.0.113.1"}))\nsys.exit(0 if via else 7)\n')
        (d/'curl').chmod(0o755)
        (d/'logread').write_text('#!/bin/sh\nprintf "%s\\n" "error outbound/direct[direct-out]: outbound connection to example.org:443" "error outbound/vless[main-out]: outbound connection to ignored.org:443"\n')
        (d/'logread').chmod(0o755)
        (d/'uci').write_text('forkop.settings=settings\nforkop.settings.smart_detect_enabled=1\nforkop.settings.smart_detect_section=main\nforkop.main=section\nforkop.main.action=connection\nforkop.main.mixed_proxy_enabled=1\nforkop.main.mixed_proxy_port=19001\n')
        (d/'config.json').write_text(json.dumps({'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.1','listen_port':19001}]}))
        self.env.update(PATH=str(d)+':'+os.environ['PATH'],FORKOP_UCI_STATE_FILE=str(d/'uci'),FORKOP_SINGBOX_CONFIG=str(d/'config.json'))
        self.assertEqual(self.call('recommendation_tick')['data']['scanned'],1)
        self.assertEqual(self.call('recommendation_tick',now=1120)['data']['scanned'],1)
        items=self.call('recommendations',now=1120)['data']['recommendations']
        self.assertEqual([x['domain'] for x in items],['example.org'])

if __name__=='__main__': unittest.main()
