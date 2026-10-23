"""The private management API must not become an anonymous LAN controller."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'


class ControllerSecurity(unittest.TestCase):
    def generate(self, settings):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / 'fixture.json'
            output = Path(directory) / 'output.json'
            fixture.write_text(json.dumps({'settings': dict({'.name': 'settings', '.type': 'settings'}, **settings), 'section': [{'.name': 'main', '.type': 'section', 'enabled': '1', 'action': 'bypass'}]}))
            run = subprocess.run(['ucode', '-L', str(LIB), str(LIB / 'singbox/generator.uc'), 'generate-config-fixture', str(fixture), str(output), '127.0.0.2'], env=dict(os.environ, FORKOP_LIB=str(LIB), FORKOP_SECTION_CACHE_DIR=directory+'/cache'), text=True, capture_output=True)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            return json.loads(output.read_text())['experimental']['clash_api']

    def test_default_management_api_is_bound_only_to_loopback(self):
        self.assertEqual(self.generate({})['external_controller'], '127.0.0.1:9090')

    def test_remote_dashboard_without_a_secret_is_not_exposed(self):
        self.assertEqual(self.generate({'enable_yacd': '1', 'enable_yacd_wan_access': '1'})['external_controller'], '127.0.0.1:9090')

    def test_explicit_authenticated_lan_dashboard_remains_supported(self):
        controller = self.generate({'enable_yacd': '1', 'yacd_secret_key': 'fixture-secret'})
        self.assertEqual(controller['external_controller'], '127.0.0.2:9090')
        self.assertEqual(controller['secret'], 'fixture-secret')

    def test_disabling_remote_dashboard_does_not_discard_configured_authentication(self):
        controller = self.generate({'enable_yacd': '0', 'yacd_secret_key': 'fixture-secret'})
        self.assertEqual(controller.get('secret'), 'fixture-secret')

    def test_rpc_proxy_uses_private_controller_and_configured_secret_without_wan_access(self):
        headers = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                headers.append(self.headers.get('Authorization'))
                authorized = headers[-1] == 'Bearer fixture-secret'
                body = json.dumps({'proxies': {}} if authorized else {'message': 'Unauthorized'}).encode()
                self.send_response(200 if authorized else 401)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                state = Path(directory) / 'state'
                state.write_text('forkop.settings=settings\nforkop.settings.service_listen_address=127.0.0.2\nforkop.settings.enable_yacd=0\nforkop.settings.yacd_secret_key=fixture-secret\n')
                env = dict(os.environ, FORKOP_LIB=str(LIB), FORKOP_UCI_STATE_FILE=str(state), SB_CLASH_API_CONTROLLER_PORT=str(server.server_port))
                run = subprocess.run(['ucode', '-L', str(LIB), str(LIB/'diagnostics/runtime.uc'), 'clash-api', 'get_proxies'], env=env, text=True, capture_output=True, timeout=10)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertTrue(run.stdout.strip(), 'The local management API did not return a response')
                self.assertEqual(json.loads(run.stdout), {'proxies': {}})
                self.assertEqual(headers, ['Bearer fixture-secret'])
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
