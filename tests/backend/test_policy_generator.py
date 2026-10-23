"""Generated policy routes share the target outbound and expire safely.
Breaks caught: generating an empty proxy group or ignoring expiry in generated routes.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from test_next_profiles import LIB

class PolicyGenerator(unittest.TestCase):
    def generate(self, expires):
        with tempfile.TemporaryDirectory() as d:
            fixture = Path(d) / 'fixture.json'
            output = Path(d) / 'config.json'
            fixture.write_text(json.dumps({'settings': {'.name':'settings','.type':'settings','dns_server':['1.1.1.1'],'bootstrap_dns_server':['1.1.1.1']},
                'section': [{'.name':'nxt_temp','.type':'section','enabled':'1','action':'connection','next_target':'main',
                             'next_kind':'temporary','next_expires':str(expires),'domain_suffix':['example.com']},
                            {'.name':'main','.type':'section','enabled':'1','action':'connection','selector_proxy_links':['vless://00000000-0000-4000-8000-000000000001@127.0.0.1:443?security=none']}]}))
            result = subprocess.run([os.getenv('UCODE','ucode'),'-L',str(LIB),str(LIB/'singbox/generator.uc'),
                'generate-config-fixture',str(fixture),str(output),'127.0.0.1'],capture_output=True,text=True,
                env=dict(os.environ,FORKOP_LIB=str(LIB),FORKOP_SECTION_CACHE_DIR=d+'/cache'))
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            return json.loads(output.read_text())

    def test_policy_routes_to_existing_outbound_without_duplicate_proxy_group(self):
        config = self.generate(4102444800)
        rules = [r for r in config['route']['rules'] if 'example.com' in str(r.get('domain_suffix','')) and r.get('action')=='route']
        self.assertTrue(rules)
        self.assertEqual(rules[0]['outbound'],'main-out')
        self.assertNotIn('nxt_temp-out',[o['tag'] for o in config['outbounds']])

    def test_expired_policy_is_absent_from_generated_routes(self):
        config = self.generate(1)
        self.assertFalse([r for r in config['route']['rules'] if 'example.com' in str(r.get('domain_suffix',''))])

    def test_first_shadow_policy_never_creates_dangling_service_outbound(self):
        for expires in [0,4102444800]:
            with self.subTest(expires=expires):
                config=self.generate(expires)
                targets={item['tag'] for item in config['outbounds']}
                for rule in config['route']['rules']:
                    if 'outbound' in rule:self.assertIn(rule['outbound'],targets)
