"""Pinned Extended REALITY tests: native Linux, isolated loopback fixtures only."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import tarfile
import tempfile
import unittest
import urllib.parse
import uuid
import zipfile

import test_current_core_interop as fixture

ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = '1.14.3-extended-2.7.3'
CORE = fixture.CORES / f'sing-box-{VERSION}-linux-amd64/sing-box'
XRAY_VERSIONS = ('26.10.21', '26.9.30', '26.6.27')


def provisioner():
    spec = importlib.util.spec_from_file_location('extended_provision', ROOT / 'tools/provision-test-cores.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExtendedProvisionTests(unittest.TestCase):
    def test_versioned_xray_install_keeps_other_versions_and_checks_digest_before_writes(self):
        provision = provisioner()
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as bundle:
            bundle.writestr('xray', b'fixture xray')
        payload = archive.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            for version in XRAY_VERSIONS:
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    provision.install_xray_archive(payload, '0' * 64, root, version=version)
                self.assertFalse((root / f'xray-{version}-linux-amd64').exists())
                path = provision.install_xray_archive(payload, hashlib.sha256(payload).hexdigest(), root, version=version)
                self.assertEqual(path, root / f'xray-{version}-linux-amd64/xray')
                self.assertEqual(path.read_bytes(), b'fixture xray')
            self.assertEqual(len(list(root.iterdir())), 3)

    def test_extended_install_checks_digest_and_extracts_only_exact_regular_executable(self):
        provision = provisioner()
        name = f'sing-box-{VERSION}-linux-amd64'
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode='w:gz') as bundle:
            member = tarfile.TarInfo(name + '/sing-box')
            payload = b'fixture extended'
            member.size = len(payload)
            bundle.addfile(member, io.BytesIO(payload))
            unsafe = tarfile.TarInfo('../escape')
            unsafe.size = 3
            bundle.addfile(unsafe, io.BytesIO(b'bad'))
        payload = archive.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory) / 'cores'
            with self.assertRaisesRegex(ValueError, 'checksum'):
                provision.install_extended_archive(payload, '0' * 64, root)
            self.assertFalse(root.exists())
            path = provision.install_extended_archive(payload, hashlib.sha256(payload).hexdigest(), root)
            self.assertEqual(path.read_bytes(), b'fixture extended')
            self.assertEqual(list(path.parent.iterdir()), [path])
            self.assertFalse((root.parent / 'escape').exists())


class ExtendedRealityTests(unittest.TestCase):
    # Reuse fixture behavior explicitly, without inheriting its test methods or
    # importing its TestCase into discovery as another test suite.
    setUp = fixture.CurrentCoreInteropTests.setUp
    redact = fixture.CurrentCoreInteropTests.redact
    diagnostics = fixture.CurrentCoreInteropTests.diagnostics
    stop_processes = fixture.CurrentCoreInteropTests.stop_processes
    process = fixture.CurrentCoreInteropTests.process
    generated_outbound = fixture.CurrentCoreInteropTests.generated_outbound
    curl = fixture.CurrentCoreInteropTests.curl
    assert_xray_reality_control = fixture.CurrentCoreInteropTests.assert_xray_reality_control
    concurrent_cover = fixture.CurrentCoreInteropTests.concurrent_cover
    assert_fresh_reality_rejection = fixture.CurrentCoreInteropTests.assert_fresh_reality_rejection

    def run_ok(self, args, env=None):
        if env is not None and env.get('FORKOP_SING_BOX_VERSION') == VERSION:
            env = dict(env, FORKOP_SINGBOX_BINARY=str(CORE))
        return fixture.CurrentCoreInteropTests.run_ok(self, args, env=env)

    @classmethod
    def setUpClass(cls):
        paths = [CORE] + [fixture.CORES / f'xray-{v}-linux-amd64/xray' for v in XRAY_VERSIONS]
        missing = [str(path) for path in paths if not path.is_file()]
        missing += [name for name in ('ucode', 'openssl', 'curl') if not shutil.which(name)]
        if missing:
            message = 'Extended integration prerequisites unavailable: ' + ', '.join(missing)
            if os.environ.get('FORKOP_REQUIRE_CURRENT_CORES') == '1':
                raise AssertionError(message)
            raise unittest.SkipTest(message)

    @contextlib.contextmanager
    def server(self, version):
        xray = fixture.CORES / f'xray-{version}-linux-amd64/xray'
        self.assertIn('Xray ' + version, self.run_ok([xray, 'version']))
        self.assertIn('sing-box version ' + VERSION, self.run_ok([CORE, 'version']))
        server_port, cover_port = fixture.free_port(), fixture.free_port()
        identity = str(uuid.uuid4())
        private, public = fixture.parse_xray_key_pair(self.run_ok([xray, 'x25519']))
        self.assertTrue(private and public)
        self.secrets.update((identity, private, public))
        freedom = {'protocol': 'freedom', 'tag': 'loopback'}
        if version == '26.10.21':
            freedom['settings'] = {'finalRules': [
                {'action': 'allow', 'network': 'tcp', 'ip': ['127.0.0.1/32'], 'port': self.target_port},
                {'action': 'block'}]}
        config = {'log': {'loglevel': 'debug'}, 'inbounds': [{
            'listen': '127.0.0.1', 'port': server_port, 'protocol': 'vless',
            'settings': {'clients': [{'id': identity, 'flow': 'xtls-rprx-vision'}], 'decryption': 'none'},
            'streamSettings': {'network': 'raw', 'security': 'reality', 'realitySettings': {
                'show': False, 'target': f'127.0.0.1:{cover_port}', 'serverNames': ['localhost'],
                'privateKey': private, 'shortIds': ['aabb']}}}],
            'outbounds': [{'protocol': 'blackhole', 'tag': 'block'}, freedom],
            'routing': {'rules': [{'type': 'field', 'network': 'tcp', 'ip': ['127.0.0.1/32'],
                                   'port': str(self.target_port), 'outboundTag': 'loopback'}]}}
        path = self.d / 'xray.json'
        path.write_text(json.dumps(config))
        self.run_ok([xray, 'run', '-test', '-c', path])
        with self.concurrent_cover(cover_port), self.process([xray, 'run', '-c', path], server_port, 'xray'):
            self.assert_xray_reality_control(server_port, identity, public)
            yield self.generated_outbound(VERSION, server_port, identity, 'reality', public)

    @contextlib.contextmanager
    def client(self, outbound, label):
        port = fixture.free_port()
        config = {'log': {'level': 'debug'}, 'inbounds': [{'type': 'mixed', 'tag': 'fixture',
                  'listen': '127.0.0.1', 'listen_port': port}], 'outbounds': [outbound],
                  'route': {'final': outbound['tag']}}
        path = self.d / 'extended.json'
        path.write_text(json.dumps(config))
        self.run_ok([CORE, 'check', '-c', path])
        with self.process([CORE, 'run', '-c', path], port, label):
            yield port

    def test_generated_reality_fetches_random_strict_https_and_rejects_bad_auth_on_three_xray_versions(self):
        for version in XRAY_VERSIONS:
            with self.subTest(xray=version), self.server(version) as outbound:
                with self.client(outbound, 'extended-' + version) as port:
                    result = self.curl(port)
                    self.assertEqual(result.returncode, 0, result.stderr.decode() + '\n' + self.diagnostics())
                    self.assertEqual(result.stdout, self.marker)
                    untrusted = self.curl(port, trusted=False)
                    self.assertEqual(untrusted.returncode, 60, untrusted.stderr.decode())
                    self.assertNotEqual(untrusted.stdout, self.marker)
                self.assertIs(outbound['tls']['reality'].get('support_x25519mlkem768'), True)
                _, wrong_key = fixture.parse_xray_key_pair(self.run_ok([fixture.XRAY, 'x25519']))
                self.secrets.add(wrong_key)
                for field, value in [('uuid', str(uuid.uuid4())), ('public_key', wrong_key), ('short_id', 'ccdd')]:
                    with self.subTest(invalid=field):
                        invalid = copy.deepcopy(outbound)
                        if field == 'uuid':
                            invalid[field] = value
                            self.secrets.add(value)
                        else:
                            invalid['tls']['reality'][field] = value
                        with self.client(invalid, 'bad-' + field + '-' + version) as port:
                            result = self.curl(port)
                            self.assertNotEqual(result.returncode, 0, 'Incorrect ' + field + ' authenticated')
                            self.assertNotEqual(result.stdout, self.marker)

    def test_current_xray_rejects_same_extended_client_with_hybrid_explicitly_disabled(self):
        with self.server('26.10.21') as outbound:
            outbound['tls']['reality']['support_x25519mlkem768'] = False
            offset = len((self.d / 'xray.log').read_text(errors='replace'))
            with self.client(outbound, 'extended-hybrid-disabled') as port:
                result = self.curl(port)
                self.assertIn(result.returncode, (28, 97), result.stderr.decode())
                self.assertNotEqual(result.stdout, self.marker)
            self.assert_fresh_reality_rejection(offset)

    def test_legacy_mode_connects_to_older_xray_without_hybrid_share(self):
        with self.server('26.6.27') as outbound:
            outbound['tls']['reality']['support_x25519mlkem768'] = False
            with self.client(outbound, 'extended-legacy-old-xray') as port:
                result = self.curl(port)
                self.assertEqual(result.returncode, 0, result.stderr.decode() + '\n' + self.diagnostics())
                self.assertEqual(result.stdout, self.marker)

    def generated_link(self, query):
        link = 'vless://00000000-0000-4000-8000-000000000001@127.0.0.1:443?' + urllib.parse.urlencode(query)
        path, output = self.d / 'feature.json', self.d / 'feature-out.json'
        path.write_text(json.dumps({'settings': {'.name': 'settings', '.type': 'settings'}, 'section': [{
            '.name': 'main', '.type': 'section', 'enabled': '1', 'action': 'connection', 'selector_proxy_links': [link]}]}))
        self.run_ok(['ucode', '-L', fixture.LIB, fixture.LIB / 'singbox/generator.uc',
                     'generate-config-fixture', path, output, '127.0.0.1'],
                    env=dict(os.environ, FORKOP_LIB=str(fixture.LIB), FORKOP_SECTION_CACHE_DIR=str(self.d / 'cache'),
                             FORKOP_SING_BOX_VERSION=VERSION))
        return next(out for out in json.loads(output.read_text())['outbounds'] if out['type'] == 'vless')

    def test_generated_extended_xhttp_and_vless_encryption_remain_available(self):
        # Schema/feature checks only: these do not claim live XHTTP or Encryption interop.
        outbound = self.generated_link({'security': 'tls', 'sni': 'localhost', 'type': 'xhttp',
                                        'mode': 'packet-up', 'path': '/fixture', 'encryption': 'none'})
        self.assertEqual(outbound['transport']['type'], 'xhttp')
        self.assertEqual(outbound['transport']['mode'], 'packet-up')
        self.assertEqual(outbound['transport']['path'], '/fixture')
        with self.client(outbound, 'extended-xhttp-schema'):
            pass
        encrypted = self.generated_link({'security': 'none', 'type': 'tcp',
                                         'encryption': 'mlkem768x25519plus.native.0rtt.' + 'A' * 43})
        self.assertEqual(encrypted['encryption'], 'mlkem768x25519plus.native.0rtt.' + 'A' * 43)
        with self.client(encrypted, 'extended-encryption-schema'):
            pass


if __name__ == '__main__':
    unittest.main()
