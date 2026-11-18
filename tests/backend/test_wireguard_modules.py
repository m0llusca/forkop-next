"""Behavioral tests for Pack 5: singbox/amnezia.uc, singbox/wireguard.uc, and warp/register.uc,
verified with real `sing-box check` across all 3 cached cores (1.13.7, 1.14.3, 1.14.3-extended-2.7.3).
"""
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "forkop/files/usr/lib"
CORES_DIR = Path(
    os.environ.get(
        "FORKOP_TEST_CORES_DIR",
        "/tmp/forkop-cores"
        if Path("/tmp/forkop-cores").exists()
        else str(Path.home() / ".cache/forkop-dev/forkop-cores"),
    )
)
SB_113 = CORES_DIR / "sing-box-1.13.7-linux-amd64/sing-box"
SB_114 = CORES_DIR / "sing-box-1.14.3-linux-amd64/sing-box"
SB_EXT = CORES_DIR / "sing-box-1.14.3-extended-2.7.3-linux-amd64/sing-box"

# Valid 32-byte base64 WireGuard keys containing '+' and '/' to test raw base64 handling!
PRIV_PLUS_SLASH = base64.b64encode(b"\xfb\xef\xff" + b"\x11" * 29).decode()  # starts with '++//'
PUB_PLUS_SLASH = base64.b64encode(b"\xf8\xfc\xff" + b"\x22" * 29).decode()   # starts with '+Pz/'
PSK_PLUS_SLASH = base64.b64encode(b"\xfb\xff\xbf" + b"\x33" * 29).decode()


def run_ucode(expr, *args, env_overrides=None):
    env = dict(os.environ)
    local_bin = str(Path.home() / ".local/bin")
    local_lib = str(Path.home() / ".local/lib")
    local_lib64 = str(Path.home() / ".local/lib64")
    env["PATH"] = f"{local_bin}:{env.get('PATH', '')}"
    env["LD_LIBRARY_PATH"] = f"{local_lib}:{local_lib64}:{env.get('LD_LIBRARY_PATH', '')}"
    ucode_bin = shutil.which("ucode", path=env.get("PATH")) or "ucode"
    if env_overrides:
        env.update(env_overrides)
    proc = subprocess.run(
        [ucode_bin, "-L", str(LIB), "-e", expr, *args],
        env=env,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise AssertionError(f"ucode failed ({proc.returncode}): {proc.stderr}\n{proc.stdout}")
    return json.loads(proc.stdout)


def singbox_check(bin_path: Path, endpoint: dict):
    assert bin_path.exists(), f"Missing cached sing-box binary: {bin_path}"
    cfg = {
        "endpoints": [endpoint],
        "outbounds": [
            {"type": "direct", "tag": "direct-out"},
            {"type": "selector", "tag": "main-out", "outbounds": [endpoint["tag"], "direct-out"], "default": endpoint["tag"]},
        ],
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json") as f:
        json.dump(cfg, f)
        f.flush()
        proc = subprocess.run([str(bin_path), "check", "-c", f.name], capture_output=True, text=True)
        if proc.returncode != 0:
            raise AssertionError(f"{bin_path.parent.name} check failed:\n{proc.stderr}\nConfig:\n{json.dumps(cfg, indent=2)}")


class WireguardAmneziaWarpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_amnezia_normalize_and_validation_rules(self):
        res = run_ucode(
            """
            let awg = require("singbox.amnezia");
            let preset = awg.default_one_sided_preset();
            let norm1 = awg.normalize({ Jc: "4", Jmin: "40", Jmax: "70", I1: "<b 0xc700000001>" });
            let norm2 = awg.normalize({ jc: 5, jmin: 50, jmax: 100, s1: "15", s2: "20", h1: "100-200", h2: "201-300", h3: 400, h4: 500 });
            let overlap = awg.normalize({ jc: 4, jmin: 10, jmax: 20, h1: "100-200", h2: 150, h3: 300, h4: 400 });
            let bad_j = awg.normalize({ jc: 4, jmin: 200, jmax: 100 });
            print(sprintf("%J", {
                one_keys: awg.ONE_SIDED_KEYS,
                two_keys: awg.TWO_SIDED_KEYS,
                preset,
                v_preset: awg.validate(preset, true),
                is_two_1: awg.is_two_sided(norm1),
                v_norm1_1s: awg.validate(norm1, true),
                is_two_2: awg.is_two_sided(norm2),
                v_norm2_1s: awg.validate(norm2, true),
                v_norm2_2s: awg.validate(norm2, false),
                v_overlap: awg.validate(overlap, false),
                v_bad_j: awg.validate(bad_j, false)
            }));
            """
        )
        self.assertEqual(res["preset"], {"jc": 4, "jmin": 40, "jmax": 70})
        self.assertTrue(res["v_preset"]["valid"])
        self.assertFalse(res["is_two_1"])
        self.assertTrue(res["v_norm1_1s"]["valid"])
        self.assertTrue(res["is_two_2"])
        self.assertFalse(res["v_norm2_1s"]["valid"], "one_sided_only must reject s1..h4")
        self.assertTrue(res["v_norm2_2s"]["valid"])
        self.assertFalse(res["v_overlap"]["valid"], "overlapping h1/h2 ranges must fail")
        self.assertFalse(res["v_bad_j"]["valid"], "jmax < jmin must fail")

    def test_share_links_wg_conf_clash_roundtrips_and_three_core_singbox_check(self):
        # Raw '+' and '/' in userinfo AND query params + IPv6 bracketed endpoint
        raw_wg_link = (
            f"wireguard://{PRIV_PLUS_SLASH}@[2001:db8::1]:51820"
            f"?address=10.66.66.2/32,fd42:42:42::2/128&publickey={PUB_PLUS_SLASH}"
            f"&psk={PSK_PLUS_SLASH}&mtu=1380&keepalive=25&reserved=11,22,33#NL%20WG%20#1"
        )
        awg_conf = f"""[Interface]
PrivateKey = {PRIV_PLUS_SLASH}
Address = 10.8.1.2/32, fd00::2/128
MTU = 1360
Jc = 4
Jmin = 40
Jmax = 70
S1 = 15
S2 = 18
S3 = 20
S4 = 24
H1 = 100001-100100
H2 = 200001-200100
H3 = 300001
H4 = 400001
I1 = <b 0xc700000001><rc 8>

[Peer]
PublicKey = {PUB_PLUS_SLASH}
PresharedKey = {PSK_PLUS_SLASH}
Endpoint = 198.51.100.55:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
"""
        clash_rec = {
            "name": "Clash-WG-Node",
            "type": "wireguard",
            "server": "203.0.113.10",
            "port": 51820,
            "ip": "172.16.0.2",
            "ipv6": "2606:4700:110::2",
            "private-key": PRIV_PLUS_SLASH,
            "public-key": PUB_PLUS_SLASH,
            "mtu": 1280,
            "reserved": base64.b64encode(bytes([7, 8, 9])).decode(),
            "amnezia-wg-option": {"jc": 4, "jmin": 40, "jmax": 70},
        }
        warp_dual_link = (
            f"warp://162.159.192.1:2408?privatekey={PRIV_PLUS_SLASH}"
            f"&publickey={PUB_PLUS_SLASH}&address=172.16.0.2/32,2606:4700:110::2/128"
            f"&reserved=44,55,66&id=reg-123&token=tok-456&license=ABCD-1234&mtu=1280&keepalive=25#WARP-Dual"
        )

        res = run_ucode(
            """
            let wg = require("singbox.wireguard");
            let p_link = wg.parse_share_link(ARGV[0]);
            let rt_link = wg.parse_share_link(wg.serialize_share_link(p_link));

            let p_conf = wg.parse_wg_conf(ARGV[1], "AWG-2S");
            let rt_conf = wg.parse_share_link(wg.serialize_share_link(p_conf));

            let p_clash = wg.parse_clash_wireguard(json(ARGV[2]));

            let p_warp = wg.parse_share_link(ARGV[3]);
            let rt_warp = wg.parse_share_link(wg.serialize_share_link(p_warp));

            print(sprintf("%J", {
                p_link, rt_link,
                p_conf, rt_conf,
                p_clash,
                p_warp, rt_warp,
                wg_stock: wg.to_singbox_endpoint(p_link, false),
                wg_ext: wg.to_singbox_endpoint(p_link, true),
                awg2_stock: wg.to_singbox_endpoint(p_conf, false),
                awg2_ext: wg.to_singbox_endpoint(p_conf, true),
                awg1_ext: wg.to_singbox_endpoint(p_clash, true),
                warp_stock: wg.to_singbox_endpoint(p_warp, false),
                warp_ext: wg.to_singbox_endpoint(p_warp, true)
            }));
            """,
            raw_wg_link,
            awg_conf,
            json.dumps(clash_rec),
            warp_dual_link,
        )

        # Roundtrip integrity
        self.assertEqual(res["p_link"]["private_key"], PRIV_PLUS_SLASH)
        self.assertEqual(res["rt_link"]["private_key"], PRIV_PLUS_SLASH)
        self.assertEqual(res["rt_link"]["peers"][0]["public_key"], PUB_PLUS_SLASH)
        self.assertEqual(res["rt_link"]["peers"][0]["address"], "2001:db8::1")
        self.assertEqual(res["rt_link"]["peers"][0]["reserved"], [11, 22, 33])
        self.assertEqual(res["rt_conf"]["amnezia"]["h1"], "100001-100100")
        self.assertEqual(res["p_clash"]["peers"][0]["reserved"], [7, 8, 9])
        self.assertEqual(res["rt_warp"]["profile"]["license_key"], "ABCD-1234")

        # Stock vs Extended expectations
        self.assertIsNone(res["awg2_stock"]["endpoint"], "AWG must fail cleanly on stock sing-box")
        self.assertTrue(res["awg2_stock"]["unsupported_reason"])
        self.assertNotIn("reserved", res["wg_ext"]["endpoint"]["peers"][0], "extended wireguard must strip peers[].reserved")
        self.assertEqual(res["warp_stock"]["endpoint"]["type"], "wireguard")
        self.assertEqual(res["warp_stock"]["endpoint"]["peers"][0]["reserved"], [44, 55, 66])
        self.assertEqual(res["warp_ext"]["endpoint"]["type"], "warp")
        self.assertNotIn("mtu", res["warp_ext"]["endpoint"])

        # Empirical `sing-box check` across ALL THREE cached binaries!
        singbox_check(SB_113, res["wg_stock"]["endpoint"])
        singbox_check(SB_114, res["wg_stock"]["endpoint"])
        singbox_check(SB_EXT, res["wg_ext"]["endpoint"])

        singbox_check(SB_EXT, res["awg2_ext"]["endpoint"])
        singbox_check(SB_EXT, res["awg1_ext"]["endpoint"])

        singbox_check(SB_113, res["warp_stock"]["endpoint"])
        singbox_check(SB_114, res["warp_stock"]["endpoint"])
        singbox_check(SB_EXT, res["warp_ext"]["endpoint"])

    def test_warp_register_against_mock_tls_cloudflare_api_and_singbox_check(self):
        cert = self.dir / "cf_cert.pem"
        key = self.dir / "cf_key.pem"
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                str(key),
                "-out",
                str(cert),
                "-days",
                "1",
                "-subj",
                "/CN=127.0.0.1",
                "-addext",
                "subjectAltName=IP:127.0.0.1",
            ],
            check=True,
            capture_output=True,
        )

        recorded_requests = []
        expected_reserved = [101, 202, 42]
        client_id_b64 = base64.b64encode(bytes(expected_reserved)).decode()

        class CfHandler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                recorded_requests.append(("POST", self.path, json.loads(raw.decode())))
                resp = {
                    "id": "cf-reg-id-999",
                    "token": "cf-secret-token-888",
                    "config": {
                        "client_id": client_id_b64,
                        "peers": [
                            {
                                "public_key": PUB_PLUS_SLASH,
                                "endpoint": {
                                    "host": "engage.cloudflareclient.com:2408",
                                    "v4": "162.159.192.1:2408",
                                },
                            }
                        ],
                        "interface": {
                            "addresses": {
                                "v4": "172.16.0.2",
                                "v6": "2606:4700:110:8a36::2",
                            }
                        },
                    },
                }
                out = json.dumps(resp).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

            def do_PUT(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                recorded_requests.append(("PUT", self.path, json.loads(raw.decode())))
                out = b'{"updated":true}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

        httpd = ThreadingHTTPServer(("127.0.0.1", 0), CfHandler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert), str(key))
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)

        api_url = f"https://127.0.0.1:{httpd.server_port}/v0a2158/reg"
        uci_state = self.dir / "uci.state"
        uci_state.write_text("forkop.badsec=section\nforkop.badsec.enabled=1\nforkop.badsec.mixed_proxy_enabled=0\n")

        # 1) Fail-closed when proxy_section is unavailable
        fail_proxy = run_ucode(
            'let r = require("warp.register"); print(sprintf("%J", r.handle({ proxy_section: "badsec" })));',
            env_overrides={
                "FORKOP_UCI_STATE_FILE": str(uci_state),
                "FORKOP_SINGBOX_BINARY": str(SB_EXT),
                "FORKOP_WARP_API_URL": api_url,
                "FORKOP_WARP_TEST_CACERT": str(cert),
            },
        )
        self.assertFalse(fail_proxy["success"])

        # 2) Standard registration (one_sided_awg=False) -> works on BOTH stock 1.14.3 AND extended!
        reg_std = run_ucode(
            """
            let r = require("warp.register");
            let wg = require("singbox.wireguard");
            let res = r.handle({ license_key: "11112222-33334444-55556666", one_sided_awg: false, tag: "WARP-Std" });
            let stock_ep = wg.to_singbox_endpoint(res.data.endpoint, false);
            let ext_ep = wg.to_singbox_endpoint(res.data.endpoint, true);
            print(sprintf("%J", { res, stock_ep, ext_ep }));
            """,
            env_overrides={
                "FORKOP_SINGBOX_BINARY": str(SB_EXT),
                "FORKOP_WARP_API_URL": api_url,
                "FORKOP_WARP_TEST_CACERT": str(cert),
            },
        )
        self.assertTrue(reg_std["res"]["success"], reg_std)
        self.assertTrue(reg_std["res"]["data"]["link"].startswith("warp://"))
        self.assertEqual(reg_std["res"]["data"]["endpoint"]["reserved"], expected_reserved)
        self.assertTrue(any(m == "POST" and len(b.get("key", "")) == 44 for m, _, b in recorded_requests))
        singbox_check(SB_114, reg_std["stock_ep"]["endpoint"])
        singbox_check(SB_EXT, reg_std["ext_ep"]["endpoint"])

        # 3) 1-sided AWG registration (one_sided_awg=True) -> adds default jc=4, jmin=40, jmax=70, passes extended check!
        reg_awg = run_ucode(
            """
            let r = require("warp.register");
            let wg = require("singbox.wireguard");
            let res = r.handle({ one_sided_awg: true, tag: "WARP-AWG" });
            let stock_ep = wg.to_singbox_endpoint(res.data.endpoint, false);
            let ext_ep = wg.to_singbox_endpoint(res.data.endpoint, true);
            print(sprintf("%J", { res, stock_ep, ext_ep }));
            """,
            env_overrides={
                "FORKOP_SINGBOX_BINARY": str(SB_EXT),
                "FORKOP_WARP_API_URL": api_url,
                "FORKOP_WARP_TEST_CACERT": str(cert),
            },
        )
        self.assertTrue(reg_awg["res"]["success"])
        self.assertEqual(reg_awg["ext_ep"]["endpoint"]["amnezia"], {"jc": 4, "jmin": 40, "jmax": 70})
        self.assertIsNone(reg_awg["stock_ep"]["endpoint"], "WARP with 1-sided AWG must reject stock sing-box")
        singbox_check(SB_EXT, reg_awg["ext_ep"]["endpoint"])


if __name__ == "__main__":
    unittest.main()
