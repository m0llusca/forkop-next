"""Real generated routes and timers: expected values are hand-selected literals."""
import json, os, subprocess, tempfile, unittest
from pathlib import Path
from test_next_profiles import LIB

class RoutingRegressions(unittest.TestCase):
    def generate(self, options=None, child=None, settings=None):
        with tempfile.TemporaryDirectory() as d:
            fixture=Path(d)/'fixture.json'; output=Path(d)/'out.json'
            section={'.name':'main','.type':'section','enabled':'1','action':'connection',
                     'selector_proxy_links':['vless://00000000-0000-4000-8000-000000000001@keep.example:443?security=none#Keep',
                                             'vless://00000000-0000-4000-8000-000000000002@drop.example:443?security=none#Drop']}
            section.update(options or {})
            data={'settings':{'.name':'settings','.type':'settings'},'section':[section]}
            data['settings'].update(settings or {})
            if child:data['urltest']=[dict({'.name':'slow','.type':'urltest','section':'main'},**child)]
            fixture.write_text(json.dumps(data))
            run=subprocess.run(['ucode','-L',str(LIB),str(LIB/'singbox/generator.uc'),'generate-config-fixture',str(fixture),str(output),'127.0.0.1'],env=dict(os.environ,FORKOP_LIB=str(LIB),FORKOP_SECTION_CACHE_DIR=d+'/cache',FORKOP_SING_BOX_VERSION=getattr(self,'version','')),capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stdout+run.stderr)
            return json.loads(output.read_text())

    def test_fresh_core_schema_adapter_is_used_in_generated_output(self):
        self.version='1.14.3'
        config=self.generate()
        self.assertNotIn('independent_cache',config['dns'])

    def test_non_dns_source_dns_packets_are_rejected(self):
        config=self.generate({'source_ip_cidr':['192.168.1.2'],'domain_suffix':['example.org']})
        self.assertTrue([rule for rule in config['route']['rules'] if rule.get('action')=='reject' and 'source-dns-in' in rule.get('inbound',[])])

    def test_ipv6_transparent_traffic_is_sniffed_for_domain_policies(self):
        # Without sniffing the IPv6 listener, TLS SNI and QUIC domain policies
        # cannot classify real-IP traffic on the same terms as IPv4 traffic.
        config=self.generate({'domain_suffix':['example.org']})
        sniffed=set()
        for rule in config['route']['rules']:
            if rule.get('action')=='sniff':
                inbound=rule.get('inbound',[])
                sniffed.update(inbound if isinstance(inbound,list) else [inbound])
        self.assertTrue({'tproxy-in','tproxy6-in'}.issubset(sniffed),sniffed)

    def test_disable_quic_rejects_both_transparent_ip_families(self):
        config=self.generate(settings={'disable_quic':'1'})
        rejected=set()
        for rule in config['route']['rules']:
            if rule.get('action')=='reject' and rule.get('protocol')=='quic':
                inbound=rule.get('inbound',[])
                rejected.update(inbound if isinstance(inbound,list) else [inbound])
        self.assertTrue({'tproxy-in','tproxy6-in'}.issubset(rejected),rejected)

    def test_manual_selector_respects_keep_existing_connections(self):
        config=self.generate({'interrupt_exist_connections':'0'})
        self.assertFalse(next(o for o in config['outbounds'] if o['tag']=='main-out')['interrupt_exist_connections'])

    def test_native_urltest_idle_timeout_is_at_least_interval(self):
        for interval in ['45m','1h30m','30.5m']:
            with self.subTest(interval=interval):
                config=self.generate(child={'check_interval':interval,'idle_timeout':'1m'})
                group=next(o for o in config['outbounds'] if o['type']=='urltest')
                self.assertEqual(group['idle_timeout'],interval)

    def test_section_exclusions_also_remove_nodes_from_automatic_group(self):
        config=self.generate({'urltest_enabled':'1','dashboard_filter_mode':'exclude','dashboard_exclude_regex':['Drop']})
        drop=next(o['tag'] for o in config['outbounds'] if o.get('server')=='drop.example')
        group=next(o for o in config['outbounds'] if o['type']=='urltest')
        self.assertNotIn(drop,group['outbounds'])

    def test_scheduler_uses_elapsed_time_independent_of_wall_clock(self):
        code='let fs=require("fs");let p=ARGV[0]+"/core/scheduler.uc";let t=fs.stat(p)?require("core.scheduler").now():0;print(t);'
        run=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB)],capture_output=True,text=True)
        self.assertEqual(run.returncode,0,run.stderr)
        uptime=float(Path('/proc/uptime').read_text().split()[0])
        self.assertLess(abs(float(run.stdout)-uptime),2)
