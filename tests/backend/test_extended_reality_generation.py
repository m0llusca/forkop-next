"""REALITY generation and preflight use trusted binary identity, not a suffix.

Exercises the actual generator and compatibility service. The manifest fixture
models a packaged trust anchor; curl is confined to the existing probe fixture.
"""
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

import test_compatibility as fixtures
import test_current_compatibility as current

LIB = fixtures.LIB
VERSION = '1.14.3-extended-2.7.3'
FLAG = 'support_x25519mlkem768'


def trusted_runtime(directory, env):
    binary = directory / 'sing-box'
    binary.write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n')
    binary.chmod(0o755)
    manifest_dir = directory / 'trusted' / 'singbox'
    manifest_dir.mkdir(parents=True)
    (manifest_dir / 'validated-cores.json').write_text(json.dumps({'schema': 1, 'cores': [{
        'version': VERSION, 'sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
        'architecture': 'fixture', 'reality_hybrid': True, 'fingerprints': ['chrome']}]}))
    env.update(FORKOP_LIB=str(manifest_dir.parent), FORKOP_SINGBOX_BINARY=str(binary))
    return binary


def reality_outbound():
    return {'type': 'vless', 'tag': 'node', 'server': '127.0.0.1', 'server_port': 443,
            'uuid': '00000000-0000-4000-8000-000000000001', 'flow': 'xtls-rprx-vision',
            'tls': {'enabled': True, 'server_name': 'example.org',
                    'utls': {'enabled': True, 'fingerprint': 'chrome'},
                    'reality': {'enabled': True, 'public_key': 'PUBLICKEY', 'short_id': 'aabb'}}}


class ExtendedRealityGenerationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.d = pathlib.Path(self.tmp.name)
        self.env = dict(os.environ, FORKOP_SING_BOX_VERSION=VERSION,
                        FORKOP_SECTION_CACHE_DIR=str(self.d / 'cache'),
                        TMP_SUBSCRIPTION_FOLDER=str(self.d / 'subscriptions'))
        self.binary = trusted_runtime(self.d, self.env)

    def generate(self, source='json', outbound=None, version=VERSION):
        outbound = copy.deepcopy(outbound or reality_outbound())
        section = {'.name': 'main', '.type': 'section', 'enabled': '1', 'action': 'connection'}
        if source == 'link':
            section['selector_proxy_links'] = ['vless://00000000-0000-4000-8000-000000000001@127.0.0.1:443?security=reality&sni=example.org&fp=chrome&pbk=PUBLICKEY&sid=aabb&flow=xtls-rprx-vision&type=tcp']
        elif source == 'subscription':
            url = 'https://example.invalid/fixture'
            section['subscription_urls'] = [url]
            directory = self.d / 'subscriptions'
            directory.mkdir(exist_ok=True)
            (directory / 'main-subscription-1.url').write_text(url + '\n')
            (directory / 'main-subscription-1.json').write_text(json.dumps({'outbounds': [outbound]}))
        else:
            section['outbound_jsons'] = [json.dumps(outbound)]
        fixture, output = self.d / 'fixture.json', self.d / 'output.json'
        fixture.write_text(json.dumps({'settings': {'.name': 'settings', '.type': 'settings'}, 'section': [section]}))
        result = subprocess.run(['ucode', '-L', str(LIB), str(LIB / 'singbox/generator.uc'),
                                 'generate-config-fixture', str(fixture), str(output), '127.0.0.1'],
                                env=dict(self.env, FORKOP_SING_BOX_VERSION=version), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return next(out for out in json.loads(output.read_text())['outbounds'] if out['type'] == 'vless')

    def test_trusted_extended_enables_hybrid_for_manual_link_json_and_subscription(self):
        # A missing final adaptation pass leaves each source unable to negotiate fresh Xray.
        for source in ('link', 'json', 'subscription'):
            with self.subTest(source=source):
                outbound = self.generate(source)
                self.assertIs(outbound['tls']['reality'].get(FLAG), True)
                self.assertFalse(outbound['tls'].get('insecure', False))

    def test_explicit_legacy_false_and_unsupported_fingerprint_are_preserved(self):
        for source in ('json', 'subscription'):
            out = reality_outbound()
            out['tls']['reality'][FLAG] = False
            self.assertIs(self.generate(source, out)['tls']['reality'][FLAG], False)
            out = reality_outbound()
            out['tls']['utls']['fingerprint'] = 'firefox'
            actual = self.generate(source, out)
            self.assertEqual(actual['tls']['utls']['fingerprint'], 'firefox')
            self.assertNotIn(FLAG, actual['tls']['reality'])

    def test_stock_old_unknown_and_forged_binary_do_not_receive_extended_schema(self):
        for version in ('1.14.3', '1.13.18-extended-2.6.5', 'unknown'):
            self.assertNotIn(FLAG, self.generate(version=version)['tls']['reality'])
        self.binary.write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n# untrusted replacement\n')
        self.assertNotIn(FLAG, self.generate()['tls']['reality'])

    def test_tls_outbound_remains_unchanged(self):
        out = reality_outbound()
        del out['tls']['reality']
        self.assertEqual(self.generate(outbound=out)['tls'], out['tls'])


class ExtendedRealityPreflightTests(unittest.TestCase):
    setUp = fixtures.CompatibilityTests.setUp
    tearDown = fixtures.CompatibilityTests.tearDown
    call = fixtures.CompatibilityTests.call
    configure = current.CurrentCompatibilityTests.configure
    write_config = current.CurrentCompatibilityTests.write_config

    def prepare(self):
        trusted_runtime(self.d, self.env)
        config = self.configure()
        config['outbounds'][0]['tls']['utls'] = {'enabled': True, 'fingerprint': 'chrome'}
        config['outbounds'][0]['tls']['reality'][FLAG] = True
        self.write_config(config)
        return config

    def probe(self, xray_version='26.10.21'):
        return self.call(section='main', server=self.server, probe=True, domain='example.org',
                         installed={'xray': xray_version, 'panel': '3.10.2'})

    def test_trusted_generated_hybrid_profile_allows_selected_section_probe(self):
        self.prepare()
        result = self.probe()
        self.assertEqual(result['data']['status'], 'verified', result)
        self.assertTrue(result['data']['probe']['reachable'])

    def test_version_label_flag_and_metadata_cannot_forge_binary_identity(self):
        self.prepare()
        (self.d / 'sing-box').write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n# changed\n')
        result = self.probe()
        self.assertEqual(result['data']['status'], 'probe_required', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_missing_or_false_flag_and_unvalidated_fingerprint_require_evidence(self):
        self.assert_unvalidated_profiles_require_evidence('26.10.21')

    def assert_unvalidated_profiles_require_evidence(self, xray_version):
        for field in ('absent', 'false', 'firefox', 'disabled_utls'):
            with self.subTest(field=field):
                # Each call gets a fresh trust fixture and independent probe log.
                if (self.d / 'trusted').exists():
                    import shutil
                    shutil.rmtree(self.d / 'trusted')
                config = self.prepare()
                tls = config['outbounds'][0]['tls']
                if field == 'absent':
                    del tls['reality'][FLAG]
                elif field == 'false':
                    tls['reality'][FLAG] = False
                elif field == 'firefox':
                    tls['utls']['fingerprint'] = 'firefox'
                else:
                    tls['utls']['enabled'] = False
                self.write_config(config)
                result = self.probe(xray_version)
                self.assertEqual(result['data']['status'], 'probe_required', result)
                self.assertFalse((self.d / 'curl.log').exists())

    def test_xray_26_9_30_requires_same_hybrid_and_fingerprint_evidence(self):
        # Native matrix confirms that this exact older release also requires
        # the hybrid key share. A generic HTTPS fixture must not certify it.
        self.assert_unvalidated_profiles_require_evidence('26.9.30')

    def test_xray_26_9_30_version_label_cannot_forge_binary_identity(self):
        self.prepare()
        (self.d / 'sing-box').write_text('#!/bin/sh\necho "sing-box version ' + VERSION + '"\n# changed\n')
        result = self.probe('26.9.30')
        self.assertEqual(result['data']['status'], 'probe_required', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_xray_26_9_30_admitted_chrome_hybrid_allows_selected_section_probe(self):
        self.prepare()
        result = self.probe('26.9.30')
        self.assertEqual(result['data']['status'], 'verified', result)
        self.assertTrue(result['data']['probe']['reachable'])

    def test_xray_26_6_27_explicit_legacy_chrome_still_allows_section_probe(self):
        config = self.prepare()
        config['outbounds'][0]['tls']['reality'][FLAG] = False
        self.write_config(config)
        result = self.probe('26.6.27')
        self.assertEqual(result['data']['status'], 'verified', result)
        self.assertTrue(result['data']['probe']['reachable'])


if __name__ == '__main__':
    unittest.main()
