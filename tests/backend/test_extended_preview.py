"""Read-only native draft preview must share the real generator's resolver.

No installed core or downloads are needed. Absence of ucode is a hard failure.
"""
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'


class ExtendedPreview(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.d = pathlib.Path(self.tmp.name)
        self.fixture = self.d / 'fixture.json'
        self.output = self.d / 'output.json'
        self.env = dict(os.environ, FORKOP_PREVIEW_CONFIG_FIXTURE=str(self.fixture),
                        FORKOP_SECTION_CACHE_DIR=str(self.output) + '.section-cache',
                        TMP_SUBSCRIPTION_FOLDER=str(self.d / 'subscriptions'),
                        FORKOP_SOURCE_EVIDENCE_DIR=str(self.d / 'source-evidence'))
        self.data = {'settings': {'.name': 'settings', '.type': 'settings'},
                     'section': [{'.name': 'main', '.type': 'section', 'enabled': '1',
                                  'action': 'connection', 'outbound_jsons': [json.dumps({
                                      'type': 'socks', 'tag': name, 'server': '127.0.0.1',
                                      'server_port': 1080, 'password': 'SECRET_SENTINEL'})
                                      for name in ['Alpha', 'Beta', 'Gamma', 'Delta']]}],
                     'urltest': [{'.name': 'u1', '.type': 'urltest', 'section': 'main',
                                  'name': 'Automatic', 'filter_mode': 'disabled'}],
                     'priority_group': [{'.name': 'p1', '.type': 'priority_group',
                                         'section': 'main', 'name': 'Fallback'}],
                     'priority_level': [
                         {'.name': 'l1', '.type': 'priority_level', 'group': 'p1',
                          'order': '10', 'filter_mode': 'include', 'server_name': ['Alpha']},
                         {'.name': 'l2', '.type': 'priority_level', 'group': 'p1',
                          'order': '20', 'filter_mode': 'include', 'server_name': ['Alpha', 'Beta']},
                         {'.name': 'l3', '.type': 'priority_level', 'group': 'p1',
                          'order': '30', 'filter_mode': 'disabled'},
                         {'.name': 'l4', '.type': 'priority_level', 'group': 'p1',
                          'order': '40', 'direct': '1'}]}

    def run_ucode(self, args):
        run = subprocess.run(['ucode', '-L', str(LIB), *args], env=self.env,
                             capture_output=True, text=True, timeout=15)
        self.assertEqual(run.returncode, 0, run.stderr + run.stdout)
        return run.stdout

    def generate(self):
        self.fixture.write_text(json.dumps(self.data))
        self.run_ucode([str(LIB / 'singbox/generator.uc'), 'generate-config-fixture',
                        str(self.fixture), str(self.output), '127.0.0.1'])
        return json.loads((pathlib.Path(str(self.output) + '.section-cache') / 'main.json').read_text())

    def request(self):
        return {'schema': 1, 'section': 'main', 'requestId': 'revision-1', 'draft': {
            'section': {}, **{k: copy.deepcopy(self.data[k]) for k in
                             ('urltest', 'priority_group', 'priority_level')}}}

    def preview(self, request=None):
        # The absent endpoint produces an assertion-level RED, never a skip.
        code = ('let fs=require("fs"); let p=ARGV[0]+"/service/extended_preview.uc"; '
                'let v=fs.stat(p)?require("service.extended_preview").preview(json(ARGV[1])):'
                '{success:false,error:"endpoint_missing"}; print(sprintf("%J",v));')
        return json.loads(self.run_ucode(['-e', code, str(LIB), json.dumps(request or self.request())]))

    def test_preview_matches_generated_members_and_first_assignment(self):
        state = self.generate()
        result = self.preview()
        self.assertTrue(result['success'], result)
        data = result['data']
        self.assertEqual(data['basis'], 'captured_source_pool')
        self.assertFalse(data['applied'])
        self.assertFalse(data['connectivity_tested'])
        self.assertEqual(data['sourceFreshness'], 'verified')
        groups = {g['id']: g for g in data['groups']}
        self.assertEqual(groups['u1']['count'], 4)
        self.assertEqual([l['count'] for l in groups['p1']['levels']], [1, 1, 2, 1])
        self.assertEqual(groups['p1']['levels'][1]['overlap'][0]['assignedLevel'], 'l1')
        self.assertEqual(groups['p1']['fallbackOrder'], ['l1', 'l2', 'l3', 'l4'])
        self.assertNotIn('SECRET_SENTINEL', json.dumps(result))
        self.assertTrue(state.get('previewBasis', {}).get('complete'))

    def test_filter_matrix_and_draft_generation_parity(self):
        for mode, include, exclude, count in [('disabled', [], [], 4),
                ('include', ['Alpha', 'Beta'], [], 2), ('exclude', [], ['Alpha'], 3),
                ('mixed', ['Alpha', 'Beta'], ['Beta'], 1), ('include', ['missing'], [], 0)]:
            with self.subTest(mode=mode, count=count):
                self.generate()
                request = self.request()
                request['draft']['urltest'][0].update(filter_mode=mode,
                        include_outbounds=include, exclude_outbounds=exclude)
                result = self.preview(request)
                self.assertTrue(result['success'], result)
                group = next(g for g in result['data']['groups'] if g['id'] == 'u1')
                self.assertEqual(group['count'], count)
                self.assertEqual(group['omitted'], count == 0)
                self.data['urltest'] = request['draft']['urltest']
                self.generate()
                generated = json.loads(self.output.read_text())['outbounds']
                actual = [o for o in generated if o['type'] == 'urltest']
                self.assertEqual(len(actual[0]['outbounds']) if actual else 0, count)

    def test_missing_stale_capture_and_foreign_children_are_unavailable(self):
        self.generate()
        cache = pathlib.Path(str(self.output) + '.section-cache') / 'main.json'
        original = cache.read_text()
        state = json.loads(original)
        state.pop('previewBasis', None)
        cache.write_text(json.dumps(state))
        self.assertEqual(self.preview()['error'], 'preview_unavailable')
        cache.write_text(original)
        request = self.request()
        request['expectedCapture'] = '0' * 64
        self.assertEqual(self.preview(request)['error'], 'capture_changed')
        request = self.request()
        request['draft']['urltest'][0]['section'] = 'foreign'
        self.assertEqual(self.preview(request)['error'], 'invalid_request')
        self.fixture.write_text(self.fixture.read_text() + '\n')
        self.assertEqual(self.preview()['error'], 'preview_unavailable')

    def test_preview_is_read_only_and_rejects_invalid_regex(self):
        self.generate()
        before = {str(p): p.read_bytes() for p in self.d.rglob('*') if p.is_file()}
        result = self.preview()
        self.assertTrue(result['success'], result)
        after = {str(p): p.read_bytes() for p in self.d.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        request = self.request()
        request['draft']['urltest'][0].update(filter_mode='include', include_regex=['['])
        self.assertEqual(self.preview(request)['error'], 'invalid_request')

    def test_large_pool_and_unknown_country(self):
        self.data['section'][0]['outbound_jsons'] = [json.dumps({
            'type': 'socks', 'tag': f'Node {i:03}', 'server': '127.0.0.1',
            'server_port': 1080}) for i in range(200)]
        self.generate()
        result = self.preview()
        self.assertTrue(result['success'], result)
        self.assertEqual(len(result['data']['candidates']), 200)
        request = self.request()
        request['draft']['urltest'][0].update(filter_mode='include',
                detect_server_country='country_is', include_countries=['DE'])
        self.assertEqual(self.preview(request)['error'], 'preview_unavailable')

    def test_source_history_is_unknown_until_recorded_and_failure_retains_success(self):
        code = ('let fs=require("fs");let p=ARGV[0]+"/subscription/evidence.uc";'
                'let m=fs.stat(p)?require("subscription.evidence"):null;'
                'let result=m?m.read("main-subscription-1","identity-a"):{missing:true};'
                'if(m && ARGV[1]=="record"){m.record("main-subscription-1","identity-a",'
                '{attemptedAt:100,succeeded:true,added:3,skipped:2});'
                'm.record("main-subscription-1","identity-a",{attemptedAt:200,succeeded:false,reason:"download_failed"});'
                'result=m.read("main-subscription-1","identity-a");}'
                'if(m && ARGV[1]=="other")result=m.read("main-subscription-1","identity-b");'
                'print(sprintf("%J",result));')
        def call(action):
            return json.loads(self.run_ucode(['-e', code, str(LIB), action]))
        self.assertEqual(call('read').get('status'), 'unknown')
        observed = call('record')
        self.assertEqual(observed['lastSuccess'], 100)
        self.assertEqual(observed['lastAttempt'], 200)
        self.assertEqual(observed['error'], 'download_failed')
        self.assertIsNone(observed['import']['duplicates'])
        self.assertIsNone(observed['import']['unsupported'])
        self.assertEqual(call('other')['status'], 'unknown')

    def test_capture_digest_hashes_exact_bytes_without_writes(self):
        code = ('let fs=require("fs");let m=require("core.sha256");'
                'print(m.digest(fs.readfile(ARGV[0])));')
        for data in [b'', b'abc', b'x' * 1000, *[b'a' * n for n in (55,56,63,64,65)],
                     'Привет 🌍'.encode(), b'first\x00last']:
            with self.subTest(data=data[:12], size=len(data)):
                path = self.d / 'digest-input'
                path.write_bytes(data)
                self.assertEqual(self.run_ucode(['-e',code,str(path)]), hashlib.sha256(data).hexdigest())
