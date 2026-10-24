"""Read-only component impact fixtures; run on Linux with real ucode/fs/uci."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'
VERSION = '1.14.3-extended-2.7.3-forkop-record1'


class ComponentImpactTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.d = Path(temporary.name)
        self.binary = self.d / 'sing-box'
        self.binary.write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n')
        self.binary.chmod(0o755)
        (self.d / 'singbox').mkdir()
        self.digest = hashlib.sha256(self.binary.read_bytes()).hexdigest()
        (self.d / 'singbox/validated-cores.json').write_text(json.dumps({'schema': 1, 'cores': [{
            'version': VERSION, 'sha256': self.digest, 'reality_hybrid': True,
            'reality_record_fragment': True, 'fingerprints': ['chrome'], 'source': 'forkop-next-record'}]}))
        (self.d / 'source').write_text('forkop-next-record\n')
        (self.d / 'variant').write_text('extended-compressed\n')
        (self.d / 'config.json').write_text(json.dumps({'outbounds': [{
            'type': 'vless', 'uuid': 'NEVER-EXPOSE', 'server': 'PRIVATE-ENDPOINT',
            'tls': {'reality': {'enabled': True, 'record_fragment_size': 0, 'public_key': 'PRIVATE-KEY'}}}]}))
        self.env = dict(os.environ, FORKOP_LIB=str(self.d), FORKOP_SINGBOX_BINARY=str(self.binary),
                        SB_SOURCE_STATE_FILE=str(self.d / 'source'), SB_VARIANT_STATE_FILE=str(self.d / 'variant'),
                        FORKOP_SINGBOX_CONFIG=str(self.d / 'config.json'))

    def call(self, component='sing_box', action='install'):
        result = subprocess.run([os.getenv('UCODE', 'ucode'), '-L', str(LIB),
                                 str(LIB / 'components/impact.uc'), 'preview',
                                 json.dumps({'component': component, 'action': action})],
                                env=self.env, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_exact_binary_admission_and_requirements_are_safe_without_mutation(self):
        before = {p.name: p.read_bytes() for p in self.d.iterdir() if p.is_file()}
        result = self.call()['data']
        self.assertEqual(result['current']['admission'], 'admitted')
        self.assertEqual(result['current']['sha256'], self.digest)
        self.assertIs(result['current']['capabilities']['reality_record_fragment'], True)
        self.assertEqual(result['requirements']['record_fragment'], 1)
        self.assertEqual(result['requirements']['basis'], 'generated_config')
        self.assertIs(result['connectivity_tested'], False)
        for secret in ('NEVER-EXPOSE', 'PRIVATE-ENDPOINT', 'PRIVATE-KEY'):
            self.assertNotIn(secret, json.dumps(result))
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.d.iterdir() if p.is_file()})

    def test_matching_version_with_changed_hash_is_unknown(self):
        self.binary.write_text(self.binary.read_text() + '# changed identity\n')
        current = self.call()['data']['current']
        self.assertEqual(current['version'], VERSION)
        self.assertEqual(current['admission'], 'unknown')
        self.assertIsNone(current['capabilities'])

    def test_targets_are_not_admitted_before_download_and_real_validation(self):
        for action, variant, source in [('install', 'extended-compressed', 'forkop-next-record'),
                                         ('install_stable', 'stable', 'official'),
                                         ('install_tiny', 'tiny', 'official'),
                                         ('install_extended', 'extended', 'official'),
                                         ('install_extended_compressed', 'extended-compressed', 'official'),
                                         ('install_forkop_record_compressed', 'extended-compressed', 'forkop-next-record')]:
            with self.subTest(action=action):
                target = self.call(action=action)['data']['target']
                self.assertEqual(target['variant'], variant)
                self.assertEqual(target['source'], source)
                self.assertEqual(target['admission'], 'unverified')
                self.assertIsNone(target['capabilities'])

    def test_invalid_requests_fail_closed_and_other_components_preserve_unknowns(self):
        self.assertIs(self.call(action='erase')['success'], False)
        self.assertIs(self.call(component='unknown')['success'], False)
        result = self.call(component='zapret', action='remove')['data']
        self.assertEqual(result['target']['variant'], 'removed')
        self.assertEqual(result['current']['admission'], 'unknown')
        self.assertIsNone(result['requirements']['record_fragment'])


if __name__ == '__main__':
    unittest.main()
