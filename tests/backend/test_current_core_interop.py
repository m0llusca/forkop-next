"""Loopback-only interoperability against pinned official current cores.

Run in isolated Linux: FORKOP_REQUIRE_CURRENT_CORES=1 python3 -m unittest
 discover -s tests/backend -p test_current_core_interop.py -v
No production probe is redirected or mocked: these tests execute the generated
VLESS outbound, real cores and curl with strict local certificate verification.
"""
import hashlib
import importlib.util
import io
import os
import pathlib
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]


class XrayProvisionTests(unittest.TestCase):
    def test_current_xray_key_output_uses_password_publickey_label(self):
        private, public = parse_xray_key_pair('PrivateKey: local-private\nPassword (PublicKey): local-public\nHash32: local-hash\n')
        self.assertEqual((private, public), ('local-private', 'local-public'))

    def test_pinned_archive_is_verified_before_executable_is_written(self):
        spec = importlib.util.spec_from_file_location('provision', ROOT / 'tools/provision-test-cores.py')
        provision = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(provision)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as bundle:
            bundle.writestr('xray', b'local test executable')
        payload = archive.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with self.assertRaisesRegex(ValueError, 'checksum'):
                provision.install_xray_archive(payload, '0' * 64, root)
            self.assertEqual(list(root.iterdir()), [])
            path = provision.install_xray_archive(payload, hashlib.sha256(payload).hexdigest(), root)
            self.assertEqual(path.read_bytes(), b'local test executable')
            if os.name != 'nt':
                self.assertTrue(path.stat().st_mode & 0o111)

import contextlib
import http.server
import json
import re
import shutil
import socket
import ssl
import subprocess
import threading
import time
import urllib.parse
import uuid

LIB = ROOT / 'forkop/files/usr/lib'
CORES = pathlib.Path('/tmp/forkop-cores')
XRAY = CORES / 'xray-26.10.21-linux-amd64/xray'
VERSIONS = ('1.13.7', '1.14.3')


def parse_xray_key_pair(output):
    keys = dict(line.split(': ', 1) for line in output.splitlines() if ': ' in line)
    return (keys.get('PrivateKey', keys.get('Private key', '')),
            keys.get('Password (PublicKey)', keys.get('Password',
                     keys.get('PublicKey', keys.get('Public key', '')))))


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


class QuietHTTP(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def do_GET(self):
        body = self.server.marker
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args):
        pass


class CurrentCoreInteropTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        missing = [str(p) for p in [XRAY] + [CORES / f'sing-box-{v}-linux-amd64/sing-box' for v in VERSIONS] if not p.is_file()]
        missing += [name for name in ('ucode', 'openssl', 'curl') if not shutil.which(name)]
        if missing:
            message = 'Current-core integration prerequisites unavailable: ' + ', '.join(missing)
            if os.environ.get('FORKOP_REQUIRE_CURRENT_CORES') == '1':
                raise AssertionError(message)
            raise unittest.SkipTest(message)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        self.processes = []
        self.secrets = set()
        self.transcript = []
        self.addCleanup(self.stop_processes)
        self.run_ok(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                     '-keyout', str(self.d / 'key.pem'), '-out', str(self.d / 'cert.pem'),
                     '-days', '1', '-subj', '/CN=localhost', '-addext',
                     'subjectAltName=DNS:localhost,IP:127.0.0.1'])
        self.marker = ('forkop-real-interop-' + uuid.uuid4().hex).encode()
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHTTP)
        server.daemon_threads = True
        server.marker = self.marker
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.minimum_version = ssl.TLSVersion.TLSv1_3
        tls.load_cert_chain(str(self.d / 'cert.pem'), str(self.d / 'key.pem'))
        server.socket = tls.wrap_socket(server.socket, server_side=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.target_port = server.server_port

    def run_ok(self, args, env=None):
        result = subprocess.run([str(x) for x in args], capture_output=True, text=True,
                                timeout=25, env=env)
        self.transcript.append(json.dumps([str(x) for x in args]) + '\nexit=' +
                               str(result.returncode) + '\n' + result.stdout + result.stderr)
        self.assertEqual(result.returncode, 0, self.redact(result.stdout + result.stderr))
        return result.stdout

    def redact(self, text):
        for secret in self.secrets:
            text = text.replace(secret, '[REDACTED]')
        text = re.sub(r'(?im)^((?:PrivateKey|Private key|Password(?: \(PublicKey\))?|PublicKey|Public key|Hash32):).*$',
                      r'\1 [REDACTED]', text)
        return re.sub(r'\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b', '[UUID]', text)

    def diagnostics(self):
        logs = []
        for path in sorted(self.d.glob('*.log')):
            logs.append(path.name + '\n' + path.read_text(errors='replace'))
        return self.redact('\n'.join(logs))

    def stop_processes(self):
        for process, log in reversed(self.processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=4)
        directory = os.environ.get('FORKOP_TEST_REPORT_DIR')
        if directory:
            destination = pathlib.Path(directory) / self._testMethodName
            destination.mkdir(mode=0o700, parents=True, exist_ok=True)
            (destination / 'commands.log').write_text(self.redact('\n'.join(self.transcript)))
            for path in self.d.glob('*.log'):
                (destination / path.name).write_text(self.redact(path.read_text(errors='replace')))
        for _, log in self.processes:
            log.close()

    @contextlib.contextmanager
    def process(self, args, port, name):
        log = (self.d / (name + '.log')).open('w+')
        child = subprocess.Popen([str(x) for x in args], stdout=log, stderr=log,
                                 stdin=subprocess.DEVNULL)
        self.transcript.append('process ' + json.dumps([str(x) for x in args]))
        self.processes.append((child, log))
        try:
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if child.poll() is not None:
                    log.seek(0)
                    self.fail(name + ' exited: ' + self.redact(log.read()))
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=.1):
                        break
                except OSError:
                    time.sleep(.05)
            else:
                self.fail(name + ' did not listen within 8 seconds')
            yield child
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=4)

    def generated_outbound(self, version, server_port, identity, security, public_key=''):
        query = {'security': security, 'sni': 'localhost', 'flow': 'xtls-rprx-vision',
                 'type': 'tcp', 'encryption': 'none'}
        if security == 'reality':
            query.update(fp='chrome', pbk=public_key, sid='aabb')
        link = f'vless://{identity}@127.0.0.1:{server_port}?' + urllib.parse.urlencode(query)
        fixture = self.d / 'fixture.json'
        output = self.d / 'generated.json'
        fixture.write_text(json.dumps({'settings': {'.name': 'settings', '.type': 'settings'},
            'section': [{'.name': 'main', '.type': 'section', 'enabled': '1',
                         'action': 'connection', 'selector_proxy_links': [link]}]}))
        self.run_ok(['ucode', '-L', LIB, LIB / 'singbox/generator.uc',
                     'generate-config-fixture', fixture, output, '127.0.0.1'],
                    env=dict(os.environ, FORKOP_LIB=str(LIB), FORKOP_SECTION_CACHE_DIR=str(self.d / 'cache'),
                             FORKOP_SING_BOX_VERSION=version))
        outbounds = json.loads(output.read_text())['outbounds']
        outbound = next(out for out in outbounds if out['type'] == 'vless')
        self.assertEqual(outbound['flow'], 'xtls-rprx-vision')
        self.assertEqual(outbound['tls']['server_name'], 'localhost')
        self.assertFalse(outbound['tls'].get('insecure', False))
        # The imported URI cannot contain a development CA path. Supply only
        # fixture trust; protocol/transport/flow/REALITY values stay generated.
        if security == 'tls':
            outbound['tls']['certificate_path'] = str(self.d / 'cert.pem')
        return outbound

    def curl(self, socks_port, trusted=True):
        args = ['curl', '--silent', '--show-error', '--fail', '--noproxy', '',
                '--proxy', f'socks5://127.0.0.1:{socks_port}', '--connect-timeout', '3',
                '--max-time', '5', '--proto', '=https']
        if trusted:
            args += ['--cacert', str(self.d / 'cert.pem')]
        args += [f'https://127.0.0.1:{self.target_port}/']
        result = subprocess.run(args, capture_output=True, timeout=8)
        self.transcript.append(json.dumps(args) + '\nexit=' + str(result.returncode) +
                               '\n' + result.stdout.decode(errors='replace') + result.stderr.decode(errors='replace'))
        return result

    def check_interop(self, security):
        self.assertIn('Xray 26.10.21', self.run_ok([XRAY, 'version']))
        server_port, cover_port = free_port(), free_port()
        identity = str(uuid.uuid4())
        self.secrets.add(identity)
        settings = {'network': 'raw', 'security': security}
        cover = contextlib.nullcontext()
        public_key = ''
        if security == 'tls':
            settings['tlsSettings'] = {'alpn': ['http/1.1'], 'minVersion': '1.3',
                'certificates': [{'certificateFile': str(self.d / 'cert.pem'),
                                  'keyFile': str(self.d / 'key.pem')}]}
        else:
            private_key, public_key = parse_xray_key_pair(self.run_ok([XRAY, 'x25519']))
            self.secrets.update((private_key, public_key))
            self.assertTrue(public_key and private_key, 'Xray x25519 returned no key pair')
            settings['realitySettings'] = {'show': False, 'target': f'127.0.0.1:{cover_port}',
                'serverNames': ['localhost'], 'privateKey': private_key, 'shortIds': ['aabb']}
            cover = self.process(['openssl', 's_server', '-accept', f'127.0.0.1:{cover_port}',
                '-cert', self.d / 'cert.pem', '-key', self.d / 'key.pem',
                '-tls1_3', '-alpn', 'h2', '-www', '-quiet'], cover_port, 'cover')
        xray_config = {'log': {'loglevel': 'debug'}, 'inbounds': [{
            'listen': '127.0.0.1', 'port': server_port, 'protocol': 'vless',
            'settings': {'clients': [{'id': identity, 'flow': 'xtls-rprx-vision'}], 'decryption': 'none'},
            'streamSettings': settings}], 'outbounds': [{'protocol': 'blackhole', 'tag': 'block'},
                # Xray 26.10.21 blocks private targets from VLESS by default.
                # Permit this one HTTPS fixture only, then block everything.
                {'protocol': 'freedom', 'tag': 'loopback', 'settings': {'finalRules': [
                    {'action': 'allow', 'network': 'tcp', 'ip': ['127.0.0.1/32'], 'port': self.target_port},
                    {'action': 'block'}]}}],
            'routing': {'rules': [{'type': 'field', 'ip': ['127.0.0.0/8'], 'outboundTag': 'loopback'}]}}
        path = self.d / 'xray.json'
        path.write_text(json.dumps(xray_config))
        self.run_ok([XRAY, 'run', '-test', '-c', path])
        with cover, self.process([XRAY, 'run', '-c', path], server_port, 'xray'):
            for version in VERSIONS:
                with self.subTest(security=security, sing_box=version):
                    core = CORES / f'sing-box-{version}-linux-amd64/sing-box'
                    self.assertIn('sing-box version ' + version, self.run_ok([core, 'version']))
                    socks_port = free_port()
                    outbound = self.generated_outbound(version, server_port, identity, security, public_key)
                    config = {'log': {'level': 'debug'}, 'inbounds': [{'type': 'mixed', 'tag': 'test',
                        'listen': '127.0.0.1', 'listen_port': socks_port}], 'outbounds': [outbound],
                        'route': {'final': outbound['tag']}}
                    client = self.d / 'sing-box.json'
                    client.write_text(json.dumps(config))
                    self.run_ok([core, 'check', '-c', client])
                    with self.process([core, 'run', '-c', client], socks_port, 'sing-' + version):
                        result = self.curl(socks_port)
                        self.assertEqual(result.returncode, 0, result.stderr.decode() + '\n' + self.diagnostics())
                        self.assertEqual(result.stdout, self.marker)
                        untrusted = self.curl(socks_port, trusted=False)
                        self.assertEqual(untrusted.returncode, 60,
                                         'Expected curl certificate rejection: ' + untrusted.stderr.decode())
                        self.assertNotEqual(untrusted.stdout, self.marker)
                    # Negative control: real incorrect authentication cannot yield
                    # the payload. This catches accidental curl proxy bypass.
                    outbound['uuid'] = str(uuid.uuid4())
                    self.secrets.add(outbound['uuid'])
                    client.write_text(json.dumps(config))
                    with self.process([core, 'run', '-c', client], socks_port, 'bad-' + version):
                        rejected = self.curl(socks_port)
                        self.assertNotEqual(rejected.returncode, 0, 'Wrong VLESS UUID authenticated')
                        self.assertNotEqual(rejected.stdout, self.marker)

    def test_generated_tls_vision_outbound_fetches_strict_https_through_both_current_cores(self):
        self.check_interop('tls')

    def test_generated_reality_vision_outbound_fetches_strict_https_through_both_current_cores(self):
        self.check_interop('reality')


if __name__ == '__main__':
    unittest.main()
