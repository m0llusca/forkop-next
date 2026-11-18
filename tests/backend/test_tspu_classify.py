"""Behavioral tests for Pack 4: service/tspu_classify.uc 4-stage TSPU classifier
against real local TLS/TCP/SOCKS5 servers in tempfile (zero --insecure).
"""
import json
import os
from pathlib import Path
import socket
import ssl
import struct
import subprocess
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "forkop/files/usr/lib"


def ucode_bin():
    cand = Path.home() / ".local/bin/ucode"
    return str(cand) if cand.exists() else "ucode"


class LocalSocks5Server:
    """Minimal RFC 1928 SOCKS5h TCP relay for testing section mixed_proxy probing."""

    def __init__(self, target_override_port):
        self.target_override_port = target_override_port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(16)
        self.port = self.sock.getsockname()[1]
        self._stop = False
        self.thread = threading.Thread(target=self._accept_loop, daemon=True)
        self.thread.start()

    def close(self):
        self._stop = True
        try:
            self.sock.close()
        except OSError:
            pass

    def _accept_loop(self):
        while not self._stop:
            try:
                client, _ = self.sock.accept()
            except OSError:
                break
            threading.Thread(target=self._handle_client, args=(client,), daemon=True).start()

    def _handle_client(self, client):
        upstream = None
        try:
            hdr = client.recv(2)
            if len(hdr) < 2 or hdr[0] != 5:
                return
            nmethods = hdr[1]
            client.recv(nmethods)
            client.sendall(b"\x05\x00")
            req = client.recv(4)
            if len(req) < 4 or req[1] != 1:
                return
            atyp = req[3]
            if atyp == 1:
                client.recv(4)
            elif atyp == 3:
                dlen = client.recv(1)[0]
                client.recv(dlen)
            elif atyp == 4:
                client.recv(16)
            client.recv(2)  # port
            upstream = socket.create_connection(("127.0.0.1", self.target_override_port), timeout=3)
            client.sendall(b"\x05\x00\x00\x01\x7f\x00\x00\x01" + struct.pack("!H", self.target_override_port))

            def pipe(src, dst):
                try:
                    while True:
                        buf = src.recv(16384)
                        if not buf:
                            break
                        dst.sendall(buf)
                except OSError:
                    pass
                finally:
                    try:
                        dst.shutdown(socket.SHUT_WR)
                    except OSError:
                        pass

            t1 = threading.Thread(target=pipe, args=(client, upstream), daemon=True)
            t2 = threading.Thread(target=pipe, args=(upstream, client), daemon=True)
            t1.start()
            t2.start()
            t1.join(timeout=5)
            t2.join(timeout=5)
        except OSError:
            pass
        finally:
            try:
                client.close()
            except OSError:
                pass
            if upstream:
                try:
                    upstream.close()
                except OSError:
                    pass


class TspuClassifyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cert_dir = tempfile.TemporaryDirectory()
        td = Path(cls.cert_dir.name)
        cls.cert_path = td / "cert.pem"
        cls.key_path = td / "key.pem"
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                str(cls.key_path),
                "-out",
                str(cls.cert_path),
                "-days",
                "1",
                "-subj",
                "/CN=probe.example.org",
                "-addext",
                "subjectAltName=DNS:probe.example.org",
            ],
            check=True,
            capture_output=True,
        )
        cls.ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        cls.ssl_ctx.load_cert_chain(str(cls.cert_path), str(cls.key_path))

    @classmethod
    def tearDownClass(cls):
        cls.cert_dir.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def start_mode_server(self, mode):
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", 0))
        srv.listen(16)
        port = srv.getsockname()[1]

        def serve():
            while True:
                try:
                    conn, _ = srv.accept()
                except OSError:
                    break
                threading.Thread(target=handle_conn, args=(conn,), daemon=True).start()

        def handle_conn(conn):
            if mode == "tls_hello_blocked":
                try:
                    conn.recv(512)
                except OSError:
                    pass
                try:
                    conn.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
                except OSError:
                    pass
                conn.close()
                return

            tls_conn = None
            try:
                tls_conn = self.ssl_ctx.wrap_socket(conn, server_side=True)
                tls_conn.recv(4096)
                if mode == "ok_64kb":
                    body = b"X" * 65536
                    hdr = (
                        f"HTTP/1.1 206 Partial Content\r\n"
                        f"Content-Length: {len(body)}\r\n"
                        f"Connection: close\r\n\r\n"
                    ).encode()
                    tls_conn.sendall(hdr + body)
                    tls_conn.close()
                elif mode == "cap_16kb":
                    hdr = (
                        b"HTTP/1.1 200 OK\r\n"
                        b"Content-Length: 65536\r\n"
                        b"Connection: close\r\n\r\n"
                    )
                    tls_conn.sendall(hdr + (b"Y" * 16384))
                    time.sleep(0.05)
                    try:
                        tls_conn.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
                    except OSError:
                        pass
                    # Abrupt close at 16,384 bytes without sending remaining body or TLS close_notify
                    socket.socket.close(tls_conn)
                    conn.close()
                elif mode == "http_451":
                    body = b"Blocked by order"
                    hdr = (
                        f"HTTP/1.1 451 Unavailable For Legal Reasons\r\n"
                        f"Content-Length: {len(body)}\r\n"
                        f"Connection: close\r\n\r\n"
                    ).encode()
                    tls_conn.sendall(hdr + body)
                    tls_conn.close()
            except Exception:
                try:
                    if tls_conn is not None:
                        socket.socket.close(tls_conn)
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass

        threading.Thread(target=serve, daemon=True).start()
        self.addCleanup(srv.close)
        return port

    def classify(self, payload, env_overrides=None):
        env = dict(os.environ)
        local_bin = str(Path.home() / ".local/bin")
        local_lib = str(Path.home() / ".local/lib")
        local_lib64 = str(Path.home() / ".local/lib64")
        env["PATH"] = f"{local_bin}:{env.get('PATH', '')}"
        env["LD_LIBRARY_PATH"] = f"{local_lib}:{local_lib64}:{env.get('LD_LIBRARY_PATH', '')}"
        if env_overrides:
            env.update(env_overrides)
        proc = subprocess.run(
            [
                ucode_bin(),
                "-L",
                str(LIB),
                "-e",
                'let m = require("service.tspu_classify"); m.cli(ARGV[0]);',
                json.dumps(payload),
            ],
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        return json.loads(proc.stdout)

    def test_domain_validation_rejects_unsafe_or_internal_targets(self):
        for bad in [
            "",
            "1.1.1.1",
            "[2606:4700::1]",
            "router.local",
            "printer.lan",
            "svc.internal",
            "box.home.arpa",
            "10.in-addr.arpa",
            "example.com:443",
            "example.com/path",
            "bad space.example.com",
            "a" * 254 + ".com",
        ]:
            res = self.classify({"domain": bad})
            self.assertFalse(res["success"], f"Expected {bad!r} to be rejected")

    def test_ok_64kb_transfer(self):
        port = self.start_mode_server("ok_64kb")
        res = self.classify(
            {"domain": "probe.example.org"},
            {
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
            },
        )
        self.assertTrue(res["success"], res)
        data = res["data"]
        self.assertEqual(data["verdict"], "ok")
        self.assertGreaterEqual(data["bytes_read"], 60160)
        byte_stage = [s for s in data["stages"] if s["stage"] == "byte_cap"][0]
        self.assertTrue(byte_stage["verified_64kb"])
        self.assertFalse(byte_stage["small_response"])

    def test_tspu_byte_cap_16kb_detection(self):
        port = self.start_mode_server("cap_16kb")
        res = self.classify(
            {"domain": "probe.example.org"},
            {
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
            },
        )
        self.assertTrue(res["success"], res)
        data = res["data"]
        self.assertEqual(data["verdict"], "tspu_byte_cap_16kb")
        self.assertEqual(data["bytes_read"], 16384)
        self.assertEqual(data["recommended_action"], "connection_or_dpi")

    def test_tls_hello_blocked_detection(self):
        port = self.start_mode_server("tls_hello_blocked")
        res = self.classify(
            {"domain": "probe.example.org"},
            {
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
            },
        )
        self.assertTrue(res["success"], res)
        self.assertEqual(res["data"]["verdict"], "tls_hello_blocked")

    def test_http_restricted_451_detection(self):
        port = self.start_mode_server("http_451")
        res = self.classify(
            {"domain": "probe.example.org"},
            {
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
            },
        )
        self.assertTrue(res["success"], res)
        self.assertEqual(res["data"]["verdict"], "http_restricted")
        self.assertEqual(res["data"]["http_code"], 451)

    def test_dns_spoofed_private_ip_detected_without_local_test_override(self):
        port = self.start_mode_server("ok_64kb")
        res = self.classify(
            {"domain": "probe.example.org"},
            {
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                # Note: FORKOP_TSPU_ALLOW_LOCAL_TEST intentionally NOT set!
            },
        )
        self.assertTrue(res["success"], res)
        self.assertEqual(res["data"]["verdict"], "dns_spoofed")

    def test_section_probe_unavailable_fails_closed_and_compare_section_verifies_bypass(self):
        blocked_port = self.start_mode_server("tls_hello_blocked")
        ok_port = self.start_mode_server("ok_64kb")
        socks = LocalSocks5Server(ok_port)
        self.addCleanup(socks.close)

        uci_state = self.dir / "uci.state"
        uci_state.write_text(
            "forkop.noproxy=section\n"
            "forkop.noproxy.enabled=1\n"
            "forkop.noproxy.mixed_proxy_enabled=0\n"
            "forkop.vpn=section\n"
            "forkop.vpn.enabled=1\n"
            "forkop.vpn.mixed_proxy_enabled=1\n"
            f"forkop.vpn.mixed_proxy_port={socks.port}\n"
        )

        # Fail-closed when section has mixed_proxy_enabled=0 or doesn't exist
        for bad_sec in ["missing_sec", "noproxy"]:
            fail_res = self.classify(
                {"domain": "probe.example.org", "section": bad_sec},
                {
                    "FORKOP_UCI_STATE_FILE": str(uci_state),
                    "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{ok_port}",
                    "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                    "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
                },
            )
            self.assertEqual(fail_res, {"success": False, "error": "section_probe_unavailable"})

        # Compare primary direct (blocked) against vpn section (ok via SOCKS5)
        cmp_res = self.classify(
            {"domain": "probe.example.org", "section": "direct", "compare_section": "vpn"},
            {
                "FORKOP_UCI_STATE_FILE": str(uci_state),
                "FORKOP_TSPU_RESOLVE_HOST_PORT": f"127.0.0.1:{blocked_port}",
                "FORKOP_TSPU_TEST_CACERT": str(self.cert_path),
                "FORKOP_TSPU_ALLOW_LOCAL_TEST": "1",
            },
        )
        self.assertTrue(cmp_res["success"], cmp_res)
        self.assertEqual(cmp_res["data"]["verdict"], "tls_hello_blocked")
        self.assertEqual(
            cmp_res["data"]["comparison"],
            {"section": "vpn", "verdict": "ok", "bypass_verified": True},
        )


if __name__ == "__main__":
    unittest.main()
