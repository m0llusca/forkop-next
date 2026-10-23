"""Manual share links must preserve TLS intent, including Trojan's TLS default.

These fixtures execute only the configuration generator and share-link parser.
They do not launch a proxy core or make network connections.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'
UUID = '00000000-0000-4000-8000-000000000001'
PUBLIC_KEY = 'tqhSkeDR6jsqC-BYCnZWBrdL33g705ba8tV5-ZboWTM'


class ManualTlsGuards(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.env = dict(os.environ,
                        FORKOP_LIB=str(LIB),
                        FORKOP_SING_BOX_VERSION='0.0.0-fixture',
                        FORKOP_SECTION_CACHE_DIR=str(self.directory / 'cache'),
                        TMP_SUBSCRIPTION_FOLDER=str(self.directory / 'subscriptions'))

    def generate(self, link):
        fixture = self.directory / 'fixture.json'
        output = self.directory / 'generated.json'
        output.unlink(missing_ok=True)
        fixture.write_text(json.dumps({
            'settings': {'.name': 'settings', '.type': 'settings'},
            'section': [{'.name': 'main', '.type': 'section', 'enabled': '1',
                         'action': 'connection', 'selector_proxy_links': [link]}],
        }))
        result = subprocess.run([
            'ucode', '-L', str(LIB), str(LIB / 'singbox/generator.uc'),
            'generate-config-fixture', str(fixture), str(output), '127.0.0.1',
        ], env=self.env, capture_output=True, text=True, timeout=15)
        outbound = None
        if result.returncode == 0:
            self.assertTrue(output.is_file(), result.stdout + result.stderr)
            config = json.loads(output.read_text())
            candidates = [item for item in config['outbounds']
                          if item['type'] in ('trojan', 'vless')]
            self.assertEqual(len(candidates), 1, config)
            outbound = candidates[0]
        return result, outbound

    def assert_tls(self, outbound):
        self.assertIsNotNone(outbound)
        self.assertIs(outbound.get('tls', {}).get('enabled'), True, outbound)
        self.assertIsNot(outbound['tls'].get('insecure'), True, outbound)

    def parse(self, link):
        result = subprocess.run([
            'ucode', '-L', str(LIB), str(LIB / 'subscription/parser.uc'),
            'share-link-outbound', link, 'fixture-node',
        ], env=self.env, capture_output=True, text=True, timeout=15)
        outbound = json.loads(result.stdout) if result.returncode == 0 else None
        return result, outbound

    def test_bare_trojan_preserves_subscription_parser_tls_default(self):
        # Trojan specifies a real TLS handshake before its authentication frame:
        # https://trojan-gfw.github.io/trojan/protocol
        for query in ('', '?sni=proxy.example'):
            with self.subTest(query=query):
                link = 'trojan://fixture-password@proxy.example:443' + query
                parsed, subscription = self.parse(link)
                self.assertEqual(parsed.returncode, 0, parsed.stdout + parsed.stderr)
                self.assert_tls(subscription)
                result, manual = self.generate(link)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assert_tls(manual)
                self.assertEqual(manual['tls'].get('server_name'),
                                 subscription['tls'].get('server_name'))

    def test_valid_vless_tls_and_reality_remain_secure(self):
        for security in ('tls', 'reality'):
            with self.subTest(security=security):
                link = (f'vless://{UUID}@proxy.example:443?security={security}'
                        f'&sni=proxy.example&fp=chrome&pbk={PUBLIC_KEY}&sid=aabb')
                result, outbound = self.generate(link)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assert_tls(outbound)
                self.assertEqual(outbound['tls']['server_name'], 'proxy.example')
                if security == 'reality':
                    self.assertIs(outbound['tls']['reality']['enabled'], True)
                    self.assertEqual(outbound['tls']['reality']['public_key'], PUBLIC_KEY)

    def test_explicit_none_preserves_deliberate_plaintext_choice(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            with self.subTest(scheme=scheme):
                result, outbound = self.generate(
                    f'{scheme}://{credential}@proxy.example:443?security=none')
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse(outbound.get('tls', {}).get('enabled', False), outbound)

    def test_unknown_security_fails_instead_of_emitting_plaintext(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            for security in ('reailty',):
                with self.subTest(scheme=scheme, security=security):
                    result, _ = self.generate(
                        f'{scheme}://{credential}@proxy.example:443?security={security}')
                    self.assertNotEqual(result.returncode, 0,
                                        'Unknown security generated a usable plaintext outbound')
                    self.assertRegex((result.stdout + result.stderr).lower(),
                                     r'security|tls', 'A rejection must explain the TLS setting')

    def test_mixed_case_and_legacy_security_are_secure_or_clearly_rejected(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            for security in ('TLS', 'REALITY', 'xtls'):
                with self.subTest(scheme=scheme, security=security):
                    result, outbound = self.generate(
                        f'{scheme}://{credential}@proxy.example:443?security={security}'
                        f'&sni=proxy.example&fp=chrome&pbk={PUBLIC_KEY}&sid=aabb')
                    if result.returncode == 0:
                        self.assert_tls(outbound)
                        if security == 'REALITY':
                            self.assertIs(outbound['tls'].get('reality', {}).get('enabled'), True)
                    else:
                        self.assertRegex((result.stdout + result.stderr).lower(), r'security|tls')

    def test_vless_missing_security_with_sni_cannot_silently_disable_tls(self):
        link = f'vless://{UUID}@proxy.example:443?sni=proxy.example'
        parsed, subscription = self.parse(link)
        self.assertEqual(parsed.returncode, 0, parsed.stdout + parsed.stderr)
        self.assert_tls(subscription)
        result, manual = self.generate(link)
        if result.returncode == 0:
            self.assert_tls(manual)
            self.assertEqual(manual['tls'].get('server_name'), 'proxy.example')
        else:
            self.assertRegex((result.stdout + result.stderr).lower(), r'security|tls')

    def test_missing_security_retains_peer_alpn_fingerprint_and_reality_hints(self):
        hints = (
            ('peer', 'peer=proxy.example'),
            ('alpn', 'alpn=h2,http/1.1'),
            ('fp', 'fp=firefox'),
            ('pbk', f'pbk={PUBLIC_KEY}&sid=aabb'),
        )
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            for hint, query in hints:
                with self.subTest(scheme=scheme, hint=hint):
                    link = f'{scheme}://{credential}@proxy.example:443?{query}'
                    parsed, subscription = self.parse(link)
                    self.assertEqual(parsed.returncode, 0, parsed.stdout + parsed.stderr)
                    self.assert_tls(subscription)
                    result, manual = self.generate(link)
                    if result.returncode != 0:
                        self.assertRegex((result.stdout + result.stderr).lower(), r'security|tls')
                        continue
                    self.assert_tls(manual)
                    if hint == 'peer':
                        self.assertEqual(manual['tls'].get('server_name'), 'proxy.example')
                        self.assertEqual(manual['tls'].get('server_name'),
                                         subscription['tls'].get('server_name'))
                    elif hint == 'alpn':
                        self.assertEqual(manual['tls'].get('alpn'), ['h2', 'http/1.1'])
                        self.assertEqual(manual['tls'].get('alpn'), subscription['tls'].get('alpn'))
                    elif hint == 'fp':
                        self.assertIs(manual['tls'].get('utls', {}).get('enabled'), True)
                        self.assertEqual(manual['tls']['utls'].get('fingerprint'), 'firefox')
                    elif hint == 'pbk':
                        reality = manual['tls'].get('reality', {})
                        self.assertIs(reality.get('enabled'), True)
                        self.assertEqual(reality.get('public_key'), PUBLIC_KEY)
                        self.assertEqual(reality.get('short_id'), 'aabb')
                        self.assertIs(manual['tls'].get('utls', {}).get('enabled'), True)
                        self.assertEqual(manual['tls']['utls'].get('fingerprint'),
                                         subscription['tls']['utls']['fingerprint'])

    def test_subscription_parser_preserves_known_secure_security_modes(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            for security in ('tls', 'reality', 'xtls'):
                with self.subTest(scheme=scheme, security=security):
                    link = (f'{scheme}://{credential}@proxy.example:443?security={security}'
                            '&sni=proxy.example&fp=chrome')
                    if security == 'reality':
                        link += f'&pbk={PUBLIC_KEY}&sid=aabb'
                    result, outbound = self.parse(link)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assert_tls(outbound)
                    self.assertEqual(outbound['tls'].get('server_name'), 'proxy.example')
                    if security == 'reality':
                        self.assertIs(outbound['tls']['reality']['enabled'], True)
                        self.assertEqual(outbound['tls']['reality']['public_key'], PUBLIC_KEY)

    def test_subscription_parser_preserves_explicit_none(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            with self.subTest(scheme=scheme):
                result, outbound = self.parse(
                    f'{scheme}://{credential}@proxy.example:443?security=none')
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse(outbound.get('tls', {}).get('enabled', False), outbound)

    def test_subscription_parser_unknown_or_mixed_case_never_emits_plaintext(self):
        for scheme, credential in (('vless', UUID), ('trojan', 'fixture-password')):
            for security in ('reailty', 'TLS', 'REALITY'):
                with self.subTest(scheme=scheme, security=security):
                    link = (f'{scheme}://{credential}@proxy.example:443?security={security}'
                            '&sni=proxy.example&fp=chrome')
                    if security == 'REALITY':
                        link += f'&pbk={PUBLIC_KEY}&sid=aabb'
                    result, outbound = self.parse(link)
                    # The parser may reject an unsupported node with no output;
                    # accepting it must retain the requested security boundary.
                    if result.returncode == 0:
                        self.assert_tls(outbound)
                        if security == 'REALITY':
                            self.assertIs(outbound['tls'].get('reality', {}).get('enabled'), True)


if __name__ == '__main__':
    unittest.main()
