"""REALITY record policy uses exact local binary admission; no proxy or probes.

Run on Linux with ucode fs+uci modules. The executable is a fixture shell script,
and all trust manifests, configurations and subscription caches are temporary.
"""
import copy
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
FIELD = 'record_fragment_size'


def outbound():
    return {'type': 'vless', 'tag': 'node', 'server': 'example.invalid', 'server_port': 443,
            'uuid': '00000000-0000-4000-8000-000000000001', 'flow': 'xtls-rprx-vision',
            'tls': {'enabled': True, 'server_name': 'example.org',
                    'utls': {'enabled': True, 'fingerprint': 'chrome'},
                    'reality': {'enabled': True, 'public_key': 'PUBLICKEY', 'short_id': 'aabb'}}}


class RecordFragmentRuntime(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.binary = self.directory / 'sing-box'
        self.binary.write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n')
        self.binary.chmod(0o755)
        self.trust = self.directory / 'trust' / 'singbox'
        self.trust.mkdir(parents=True)
        self.env = dict(os.environ, FORKOP_LIB=str(self.trust.parent),
                        FORKOP_SINGBOX_BINARY=str(self.binary), FORKOP_SING_BOX_VERSION=VERSION,
                        FORKOP_SECTION_CACHE_DIR=str(self.directory / 'cache'),
                        TMP_SUBSCRIPTION_FOLDER=str(self.directory / 'subscriptions'))
        self.profile()

    def profile(self, record=True, version=VERSION):
        profile = {'version': version, 'sha256': hashlib.sha256(self.binary.read_bytes()).hexdigest(),
                   'reality_hybrid': True, 'fingerprints': ['chrome']}
        if record:
            profile['reality_record_fragment'] = True
        (self.trust / 'validated-cores.json').write_text(json.dumps({'schema': 1, 'cores': [profile]}))

    def fixture(self, value, source='json', legacy=False):
        section = {'.name': 'main', '.type': 'section', 'enabled': '1', 'action': 'connection'}
        if source == 'link':
            section['selector_proxy_links'] = ['vless://00000000-0000-4000-8000-000000000001@example.invalid:443?security=reality&sni=example.org&fp=chrome&pbk=PUBLICKEY&sid=aabb&flow=xtls-rprx-vision&type=tcp']
        elif source == 'subscription':
            url = 'https://example.invalid/fixture'
            section['subscription_urls'] = [url]
            directory = self.directory / 'subscriptions'
            directory.mkdir(exist_ok=True)
            (directory / 'main-subscription-1.url').write_text(url + '\n')
            (directory / 'main-subscription-1.json').write_text(json.dumps({'outbounds': [value]}))
        elif legacy:
            section.update(action='outbound', outbound_json=json.dumps(value))
        else:
            section['outbound_jsons'] = [json.dumps(value)]
        path = self.directory / 'input.json'
        path.write_text(json.dumps({'settings': {'.name': 'settings', '.type': 'settings',
                                                'dns_server': ['1.1.1.1'], 'bootstrap_dns_server': ['1.1.1.1']},
                                    'section': [section]}))
        return path

    def run_cli(self, module, *args, version=VERSION):
        return subprocess.run([os.getenv('UCODE', 'ucode'), '-L', str(LIB), str(LIB / module),
                               *map(str, args)], env=dict(self.env, FORKOP_SING_BOX_VERSION=version),
                              capture_output=True, text=True, timeout=20)

    def generate(self, value=None, source='json', version=VERSION):
        value = copy.deepcopy(value if value is not None else outbound())
        destination = self.directory / 'output.json'
        destination.unlink(missing_ok=True)
        result = self.run_cli('singbox/generator.uc', 'generate-config-fixture',
                              self.fixture(value, source), destination, '127.0.0.1', version=version)
        generated = None
        if result.returncode == 0:
            generated = next(item for item in json.loads(destination.read_text())['outbounds'] if item['type'] == 'vless')
        return result, generated

    def validate(self, value, legacy=False, version=VERSION):
        return self.run_cli('config/validator.uc', 'validate-runtime-fixture',
                            self.fixture(value, legacy=legacy), '{}', version=version)

    def test_record_profile_adds_256_for_links_json_and_subscriptions_without_security_changes(self):
        for source in ('link', 'json', 'subscription'):
            with self.subTest(source=source):
                result, generated = self.generate(source=source)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(generated['tls']['reality'][FIELD], 256)
                self.assertIs(generated['tls']['reality']['support_x25519mlkem768'], True)
                self.assertIsNot(generated['tls'].get('insecure'), True)
                self.assertEqual(generated['flow'], 'xtls-rprx-vision')
                self.assertEqual(generated['tls']['server_name'], 'example.org')

    def test_explicit_zero_and_valid_custom_size_are_preserved(self):
        for source in ('json', 'subscription'):
            for size in (0, 1, 256, 16384):
                with self.subTest(source=source, size=size):
                    value = outbound()
                    value['tls']['reality'][FIELD] = size
                    result, generated = self.generate(value, source)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(generated['tls']['reality'][FIELD], size)

    def test_existing_nonrecord_profile_keeps_previous_hybrid_policy(self):
        self.profile(record=False)
        result, generated = self.generate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(FIELD, generated['tls']['reality'])
        self.assertIs(generated['tls']['reality']['support_x25519mlkem768'], True)

    def test_auto_policy_requires_supported_chrome_reality(self):
        for mode in ('firefox', 'disabled_utls', 'disabled_tls', 'disabled_reality', 'no_reality'):
            value = outbound()
            if mode == 'firefox':
                value['tls']['utls']['fingerprint'] = 'firefox'
            elif mode == 'disabled_utls':
                value['tls']['utls']['enabled'] = False
            elif mode == 'disabled_tls':
                value['tls']['enabled'] = False
            elif mode == 'disabled_reality':
                value['tls']['reality']['enabled'] = False
            else:
                del value['tls']['reality']
            result, generated = self.generate(value)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn(FIELD, generated['tls'].get('reality', {}))

    def test_unknown_version_or_changed_executable_cannot_enable_auto_policy(self):
        result, generated = self.generate(version='1.14.3')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(FIELD, generated['tls']['reality'])
        self.binary.write_text(self.binary.read_text() + '# changed identity\n')
        result, generated = self.generate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(FIELD, generated['tls']['reality'])

    def test_validator_accepts_integer_boundaries_for_current_and_legacy_json(self):
        for legacy in (False, True):
            for size in (0, 1, 256, 16384):
                value = outbound()
                value['tls']['reality'][FIELD] = size
                result = self.validate(value, legacy)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_validator_rejects_invalid_json_types_and_out_of_range_values(self):
        for legacy in (False, True):
            for size in (-1, 1.5, 16385, 65536, True, False, '256', None, {}, []):
                with self.subTest(legacy=legacy, size=size):
                    value = outbound()
                    value['tls']['reality'][FIELD] = size
                    result = self.validate(value, legacy)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(FIELD, result.stdout + result.stderr)
                    self.assertNotIn('PUBLICKEY', result.stdout + result.stderr)

    def test_even_explicit_zero_requires_exact_record_capability(self):
        for mode in ('missing_record_flag', 'stock_version', 'unknown_version', 'changed_hash'):
            for size in (0, 256):
                with self.subTest(mode=mode, size=size):
                    self.setUp_profile_after_identity_test()
                    version = VERSION
                    if mode == 'missing_record_flag':
                        self.profile(record=False)
                    elif mode == 'stock_version':
                        version = '1.14.3'
                    elif mode == 'unknown_version':
                        version = 'unknown'
                    else:
                        self.binary.write_text(self.binary.read_text() + '# changed hash\n')
                    value = outbound()
                    value['tls']['reality'][FIELD] = size
                    result = self.validate(value, version=version)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(FIELD, result.stdout + result.stderr)

    def setUp_profile_after_identity_test(self):
        self.binary.write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n')
        self.profile()

    def test_generator_rejects_invalid_or_unsupported_explicit_subscription_field(self):
        for size in (-1, 1.5, '256', None):
            value = outbound()
            value['tls']['reality'][FIELD] = size
            result, generated = self.generate(value, 'subscription')
            self.assertNotEqual(result.returncode, 0)
            self.assertIsNone(generated)
            self.assertIn(FIELD, result.stdout + result.stderr)
        self.profile(record=False)
        value['tls']['reality'][FIELD] = 0
        result, _ = self.generate(value, 'subscription')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(FIELD, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
