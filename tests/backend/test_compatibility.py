import copy,json,os,pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];LIB=ROOT/'forkop/files/usr/lib'
class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.d=pathlib.Path(self.tmp.name)
        (self.d/'curl').write_text('''#!/usr/bin/env python3
import os,sys,json
with open(os.environ['CURL_LOG'],'a') as f:f.write(json.dumps(sys.argv[1:])+'\\n')
if os.environ.get('CURL_FAIL'):sys.exit(28)
if any('releases/latest' in x for x in sys.argv):print(json.dumps({'tag_name':os.environ.get('LATEST','v99.1.0'),'html_url':'https://evil.invalid','prerelease':False,'draft':False}))
else:print('{"http_status":200,"duration":0.1,"remote_ip":"203.0.113.1"}')
''');(self.d/'curl').chmod(0o755)
        (self.d/'sing-box').write_text('#!/bin/sh\necho "sing-box version 1.14.3"\n');(self.d/'sing-box').chmod(0o755)
        (self.d/'state').write_text('forkop.main=section\nforkop.main.mixed_proxy_enabled=1\nforkop.main.mixed_proxy_port=12345\n')
        self.env=dict(os.environ,PATH=str(self.d)+':'+os.environ['PATH'],CURL_LOG=str(self.d/'curl.log'),FORKOP_UCI_STATE_FILE=str(self.d/'state'),FORKOP_SINGBOX_CONFIG=str(self.d/'config.json'))
        self.client={'protocol':'vless','transport':'tcp','flow':'xtls-rprx-vision','encryption':'none','security':'reality','sni':'example.org','reality':{'public_key':'SECRETKEY','short_id':'aabb'}}
        self.server={'protocol':'vless','transport':'tcp','flow':'xtls-rprx-vision','encryption':'none','security':'reality','server_names':['example.org'],'short_ids':['aabb'],'private_key':'PRIVATESECRET','uuid':'UUIDSECRET'}
    def tearDown(self):self.tmp.cleanup()
    def call(self,action='compatibility_check',**payload):
        code='let fs=require("fs"); let r=fs.stat(ARGV[0]+"/service/compatibility.uc")?require("service.compatibility").handle(ARGV[1],json(ARGV[2])):{success:false,error:"feature_unavailable"}; print(sprintf("%J",r));'
        r=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB),action,json.dumps(payload)],env=self.env,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr);return json.loads(r.stdout)
    def check(self,**kw):return self.call(client=self.client,server=self.server,**kw)
    def test_matching_metadata_requires_real_section_probe_and_redacts_secrets(self):
        r=self.check();self.assertTrue(r['success'],r);self.assertEqual(r['data']['status'],'probe_required')
        for secret in ['SECRETKEY','PRIVATESECRET','UUIDSECRET','aabb','example.org']:self.assertNotIn(secret,json.dumps(r))
    def test_mismatched_transport_flow_encryption_security_sni_and_shortid_block(self):
        for key,value in [('transport','ws'),('flow',''),('encryption','mlkem768x25519plus.native'),('security','tls'),('server_names',['other.org']),('short_ids',['ffff'])]:
            with self.subTest(key=key):
                server=copy.deepcopy(self.server);server[key]=value
                r=self.call(client=self.client,server=server);self.assertTrue(r['success'],r);self.assertEqual(r['data']['status'],'unsupported',r)
    def test_unknown_or_new_capability_is_not_approved_by_versions(self):
        for field,value in [('transport','future'),('flow','xtls-rprx-vision-udp443'),('encryption','mlkem768x25519plus.native')]:
            c=copy.deepcopy(self.client);s=copy.deepcopy(self.server);c[field]=s[field]=value
            r=self.call(client=c,server=s,installed={'xray':'99.1','panel':'99.1'})
            self.assertNotEqual(r['data']['status'],'verified');self.assertTrue(any(x.get('next_step') for x in r['data']['checks']))
    def test_generic_probe_and_forged_evidence_cannot_verify_handshake(self):
        r=self.check(probe=True,domain='example.org',verified=True);self.assertEqual(r['data']['status'],'probe_required')
        self.assertFalse((self.d/'curl.log').exists())
    def test_empty_metadata_requires_configuration(self):
        r=self.call();self.assertTrue(r['success']);self.assertEqual(r['data']['status'],'probe_required')
    def test_local_generated_outbound_allows_explicit_section_probe(self):
        out={'type':'vless','tag':'main-out','flow':'xtls-rprx-vision','uuid':'UUIDSECRET','tls':{'enabled':True,'server_name':'example.org','reality':{'enabled':True,'public_key':'SECRETKEY','short_id':'aabb'}}}
        (self.d/'config.json').write_text(json.dumps({'outbounds':[out],'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.1','listen_port':12345}],'route':{'rules':[{'inbound':'main-mixed-in','outbound':'main-out','action':'route'}]}}))
        r=self.call(section='main',outbound_tag='main-out',server=self.server,probe=True,domain='example.org')
        self.assertTrue(r['success'],r);self.assertEqual(r['data']['status'],'verified',r)
    def test_stock_core_nonstandard_features_are_never_verified(self):
        self.client['encryption']=self.server['encryption']='mlkem768x25519plus.native'
        r=self.check();self.assertEqual(r['data']['status'],'unsupported')
    def test_update_check_fixed_official_bounded_destinations_and_missing_remote_unknown(self):
        r=self.call('compatibility_updates',installed={'panel':'3.0.0','xray':'26.1.0'},url='https://evil.invalid')
        self.assertTrue(r['success'],r);self.assertFalse(r['data']['automatic_install'])
        self.assertEqual([x['status'] for x in r['data']['updates']],['update_available']*2)
        args=[json.loads(x) for x in (self.d/'curl.log').read_text().splitlines()]
        self.assertEqual(len(args),2)
        for a in args:
            self.assertIn('--max-time',a);self.assertIn('8',a);self.assertIn('--max-filesize',a)
            self.assertFalse(any('evil.invalid' in x for x in a))
        self.env['CURL_FAIL']='1';r=self.call('compatibility_updates')
        self.assertEqual([x['status'] for x in r['data']['updates']],['unknown']*2)
    def test_versions_are_compared_numerically_and_prereleases_unknown(self):
        self.env['LATEST']='v3.10.2';r=self.call('compatibility_updates',installed={'panel':'3.9.9'})
        self.assertEqual(r['data']['updates'][0]['status'],'update_available')
        self.env['LATEST']='v3.11.0-rc1';r=self.call('compatibility_updates',installed={'panel':'3.9.9'})
        self.assertEqual(r['data']['updates'][0]['status'],'unknown')
    def test_malformed_metadata_rejected(self):
        r=self.call(client='private credentials');self.assertEqual(r.get('error'),'invalid_compatibility_metadata')
    def test_section_discovers_direct_outbound_without_internal_tag_input(self):
        out={'type':'vless','tag':'main-out','flow':'xtls-rprx-vision','tls':{'enabled':True,'server_name':'example.org','reality':{'enabled':True,'public_key':'SECRETKEY','short_id':'aabb'}}}
        (self.d/'config.json').write_text(json.dumps({'outbounds':[out],'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.1','listen_port':12345}],'route':{'rules':[{'inbound':'main-mixed-in','outbound':'main-out','action':'route'}]}}))
        r=self.call(section='main',server=self.server,probe=True,domain='example.org')
        self.assertEqual(r['data']['outbounds'],[{'outbound_tag':'main-out','label':'main-out'}]);self.assertEqual(r['data']['status'],'verified')
    def test_earlier_catchall_route_prevents_false_selected_server_verification(self):
        out={'type':'vless','tag':'main-out','flow':'xtls-rprx-vision','tls':{'enabled':True,'server_name':'example.org','reality':{'enabled':True,'public_key':'SECRETKEY','short_id':'aabb'}}}
        (self.d/'config.json').write_text(json.dumps({'outbounds':[out],'inbounds':[{'type':'mixed','tag':'main-mixed-in','listen':'127.0.0.1','listen_port':12345}],'route':{'rules':[{'action':'route','outbound':'direct'},{'inbound':'main-mixed-in','outbound':'main-out','action':'route'}]}}))
        r=self.call(section='main',server=self.server,probe=True,domain='example.org');self.assertEqual(r['data']['status'],'probe_required')
        self.assertFalse((self.d/'curl.log').exists())
    def test_metadata_version_fields_cannot_echo_credentials(self):
        for action in ['compatibility_check','compatibility_updates']:
            r=self.call(action,installed={'panel':'PRIVATESECRET','xray':'PRIVATESECRET'})
            self.assertNotIn('PRIVATESECRET',json.dumps(r))
class SchemaAdapterTests(unittest.TestCase):
    def fixture(self):
        return {'dns':{'servers':[{'type':'udp','tag':'local','server':'127.0.0.1'},{'type':'udp','tag':'remote','server':'1.1.1.1'}],'independent_cache':True,'rules':[{'type':'logical','mode':'and','rules':[{'source_ip_cidr':'192.0.2.10/32','domain_suffix':['example.org']},{'ip_cidr':['198.18.0.0/15','fc00::/18'],'invert':True}],'action':'route','server':'local','rewrite_ttl':60},{'action':'route','server':'remote','query_type':['A','AAAA']}]},'outbounds':[{'type':'direct','tag':'direct'}],'route':{'rule_set':[{'type':'remote','tag':'remote-list','format':'source','url':'https://example.org/list.json','download_detour':'direct'}],'final':'direct'}}
    def transform(self,config,version):
        code='let fs=require("fs");let c=json(ARGV[1]);let r=fs.stat(ARGV[0]+"/singbox/compatibility.uc")?require("singbox.compatibility").transform(c,ARGV[2]):c;print(sprintf("%J",r));'
        r=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB),json.dumps(config),version],text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr);return json.loads(r.stdout)
    def test_114_migrates_answer_matching_without_changing_source_scope_or_fallback(self):
        c=self.transform(self.fixture(),'1.14.3');self.assertNotIn('independent_cache',c['dns'])
        evaluate,respond,fallback=c['dns']['rules']
        self.assertEqual(evaluate,{'source_ip_cidr':'192.0.2.10/32','domain_suffix':['example.org'],'action':'evaluate','server':'local','rewrite_ttl':60})
        self.assertEqual(respond['action'],'respond');self.assertTrue(respond['rules'][1]['match_response']);self.assertTrue(respond['rules'][1]['invert'])
        self.assertEqual(fallback,{'action':'route','server':'remote','query_type':['A','AAAA']})
    def test_113_configuration_preserved_including_download_route(self):
        c=self.fixture();self.assertEqual(self.transform(c,'1.13.18-extended-2.6.5'),c)
    def test_114_http_client_preserves_proxy_download_detour(self):
        c=self.transform(self.fixture(),'1.14.3');r=c['route']['rule_set'][0]
        self.assertNotIn('download_detour',r);self.assertEqual(r['http_client'],{'detour':'direct'})
        self.assertEqual(c['route']['default_http_client'],'forkop-ruleset-http');self.assertIn({'tag':'forkop-ruleset-http'},c['http_clients'])
    def test_114_reapplication_is_idempotent(self):
        c=self.transform(self.fixture(),'1.14.3');self.assertEqual(self.transform(c,'1.14.3'),c)
    def test_114_does_not_replace_existing_named_http_client(self):
        c=self.fixture();c['http_clients']=[{'tag':'custom','detour':'direct'}];c['route']['default_http_client']='custom';c['route']['rule_set'][0]['http_client']='custom';del c['route']['rule_set'][0]['download_detour']
        c=self.transform(c,'1.14.3');self.assertEqual(c['route']['default_http_client'],'custom');self.assertEqual(c['route']['rule_set'][0]['http_client'],'custom')
    def test_published_113_and_114_core_schema_checks(self):
        cores=[('1.13.7',pathlib.Path('/tmp/forkop-cores/sing-box-1.13.7-linux-amd64/sing-box')),('1.14.3',pathlib.Path('/tmp/forkop-cores/sing-box-1.14.3-linux-amd64/sing-box'))]
        if not all(p.exists() for _,p in cores):self.skipTest('Published cores not provisioned in this development environment')
        with tempfile.TemporaryDirectory() as d:
            for v,p in cores:
                with self.subTest(version=v):
                    fixture=self.fixture();fixture['route']['default_domain_resolver']='local'
                    config=self.transform(fixture,v);path=pathlib.Path(d)/'config.json';path.write_text(json.dumps(config))
                    r=subprocess.run([str(p),'check','-c',str(path)],capture_output=True,text=True)
                    self.assertEqual(r.returncode,0,r.stdout+r.stderr)
if __name__=='__main__':unittest.main()
