"""Behavioral tests for Pack 2A: core.common private FS helpers, singbox.filter_identity,
singbox.group_resolver 3-tier matching, and service.selection endpoint + canonical_label support.
"""
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "forkop/files/usr/lib"


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


class FilterIdentityAndResolverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_common_secure_private_dir_and_private_json_file(self):
        priv_dir = self.dir / "nested" / "private"
        symlink_dir = self.dir / "symlink_dir"
        real_other = self.dir / "real_other"
        real_other.mkdir(mode=0o755)
        symlink_dir.symlink_to(real_other)
        secret_json = priv_dir / "state.json"

        res = run_ucode(
            """
            let common = require("core.common");
            let ok1 = common.secure_private_dir(ARGV[0]);
            let bad_sym = common.secure_private_dir(ARGV[1]);
            let ok_write = common.write_private_json_file(ARGV[2], { token: "secret-123", count: 2 });
            let read_back = common.read_json_file(ARGV[2]);
            print(sprintf("%J", { ok1, bad_sym, ok_write, read_back }));
            """,
            str(priv_dir),
            str(symlink_dir),
            str(secret_json),
        )
        self.assertTrue(res["ok1"])
        self.assertFalse(res["bad_sym"], "secure_private_dir must reject symlinks")
        self.assertTrue(res["ok_write"])
        self.assertEqual(res["read_back"], {"token": "secret-123", "count": 2})
        self.assertEqual(stat.S_IMODE(priv_dir.lstat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(secret_json.lstat().st_mode), 0o600)

    def test_connection_id_is_in_process_canonical_and_strips_volatile_fields(self):
        base = {
            "type": "vless",
            "tag": "🇩🇪 Germany #1 | 10.0 GB",
            "server": "de1.example.com",
            "server_port": 443,
            "uuid": "11111111-2222-3333-4444-555555555555",
            "tls": {"enabled": True, "server_name": "sni.example.com", "utls": {"enabled": True, "fingerprint": "chrome"}},
        }
        wrapped = {
            "server_port": 443,
            "uuid": "11111111-2222-3333-4444-555555555555",
            "type": "vless",
            "server": "de1.example.com",
            "tag": "🇩🇪 Germany #1 | 85.4 GB",
            "remark": "updated remark",
            "share_link": "vless://...",
            "detour": "cascade-out",
            "domain_resolver": "bootstrap-dns",
            "routing_mark": 255,
            "bind_interface": "eth1",
            "inet4_bind_address": "192.0.2.5",
            "inet6_bind_address": "2001:db8::5",
            "__forkop_hidden": True,
            "__forkop_source": "sub1",
            "tls": {"utls": {"fingerprint": "chrome", "enabled": True}, "server_name": "sni.example.com", "enabled": True},
        }
        changed = dict(base, server_port=8443)
        wg_ep = {
            "type": "wireguard",
            "tag": "WG-NL",
            "address": ["10.0.0.2/32"],
            "private_key": "priv==",
            "peers": [{"address": "198.51.100.10", "port": 51820, "public_key": "pub=="}],
        }

        # Run with PATH="" to prove zero external subprocess / sha256sum calls
        res = run_ucode(
            """
            let fi = require("singbox.filter_identity");
            print(sprintf("%J", {
                c1: fi.connection_id(json(ARGV[0])),
                c2: fi.connection_id(json(ARGV[1])),
                c3: fi.connection_id(json(ARGV[2])),
                c_wg: fi.connection_id(json(ARGV[3])),
                c_sel: fi.connection_id({ type: "selector", tag: "s", outbounds: ["a"] }),
                c_ut: fi.connection_id({ type: "urltest", tag: "u", outbounds: ["a"] }),
                c_dir: fi.connection_id({ type: "direct", tag: "direct-out" }),
                c_null: fi.connection_id(null)
            }));
            """,
            json.dumps(base),
            json.dumps(wrapped),
            json.dumps(changed),
            json.dumps(wg_ep),
            env_overrides={"PATH": ""},
        )
        self.assertRegex(res["c1"], r"^cid1:[0-9a-f]{24}$")
        self.assertEqual(res["c1"], res["c2"])
        self.assertNotEqual(res["c1"], res["c3"])
        self.assertRegex(res["c_wg"], r"^cid1:[0-9a-f]{24}$")
        self.assertEqual(res["c_sel"], "")
        self.assertEqual(res["c_ut"], "")
        self.assertEqual(res["c_dir"], "")
        self.assertEqual(res["c_null"], "")

    def test_canonical_label_and_merge_alias_history(self):
        res = run_ucode(
            """
            let fi = require("singbox.filter_identity");
            let labels = [
                "🇩🇪 Germany #1 🟢 | 45.2 GB",
                "🇩🇪 Germany #1 🔴 [12.3 GiB / 100 GB] (14d left)",
                "🇳🇱 NL-1 ⚡ - 99.1GB",
                "🇷🇺 Москва 02 🚀 • 5.5 GB",
                "🟢 🛡️ [12.3 GiB / 100 GB]",
                "--- ⚡ 🔥 ---"
            ];
            let norm = [];
            for (let l in labels) push(norm, fi.canonical_label(l));

            let h = [];
            for (let i = 1; i <= 20; i++) {
                h = fi.merge_alias_history(h, "Node | " + i + " GB", "Node | " + (i + 1) + " GB", 16);
            }
            let h_same = fi.merge_alias_history(h, "Node | 21 GB", "Node | 21 GB", 16);
            print(sprintf("%J", { norm, h, h_same }));
            """
        )
        self.assertEqual(res["norm"][0], "Germany #1")
        self.assertEqual(res["norm"][1], "Germany #1")
        self.assertEqual(res["norm"][2], "NL-1")
        self.assertEqual(res["norm"][3], "Москва 02")
        self.assertEqual(res["norm"][4], "")
        self.assertEqual(res["norm"][5], "")
        self.assertEqual(len(res["h"]), 16)
        self.assertEqual(res["h"][-1], "Node | 20 GB")
        self.assertNotIn("Node | 1 GB", res["h"])
        self.assertEqual(res["h"], res["h_same"])

    def test_group_resolver_three_tier_include_exclude_and_ambiguity_guards(self):
        res = run_ucode(
            """
            let resolver = require("singbox.group_resolver").create({});
            let tags = ["t_exact", "t_alias", "t_canon", "t_amb1", "t_amb2", "t_dup1", "t_dup2"];
            let names = {
                t_exact: "🇺🇸 US #1 | 50 GB",
                t_alias: "🇫🇮 Helsinki-02 | 88.1 GB",
                t_canon: "🇩🇪 Frankfurt #3 🔴 [91.2 GiB / 100 GB]",
                t_amb1: "🇳🇱 Amsterdam 🟢 | 10 GB",
                t_amb2: "🇳🇱 Amsterdam ⚡ | 20 GB",
                t_dup1: "🇸🇪 Stockholm #1 | 30 GB",
                t_dup2: "🇸🇪 Stockholm #1 (Mirror) | 30 GB"
            };
            let metadata = {
                names,
                filterIds: {
                    t_exact: "cid1:111111111111111111111111",
                    t_alias: "cid1:222222222222222222222222",
                    t_canon: "cid1:333333333333333333333333",
                    t_amb1: "cid1:444444444444444444444444",
                    t_amb2: "cid1:555555555555555555555555",
                    t_dup1: "cid1:666666666666666666666666",
                    t_dup2: "cid1:666666666666666666666666"
                },
                filterNames: {
                    t_alias: ["🇫🇮 Finland Promo Old Name"],
                    t_amb1: ["Shared Old Alias"],
                    t_amb2: ["Shared Old Alias"],
                    t_dup1: ["🇸🇪 Old Same CID"],
                    t_dup2: ["🇸🇪 Old Same CID"]
                }
            };

            let inc = resolver.filter_candidate_outbounds(
                "include", tags, names, {}, metadata,
                [
                    "🇺🇸 US #1 | 50 GB",                // Tier 1 exact
                    "🇫🇮 Finland Promo Old Name",       // Tier 2 unique alias
                    "🇩🇪 Frankfurt #3 🟢 | 12.0 GB",    // Tier 3 canonical_label
                    "🇳🇱 Amsterdam 🔥 | 99 GB",         // Ambiguous Tier 3 -> MUST NOT match
                    "Shared Old Alias",                 // Ambiguous Tier 2 -> MUST NOT match
                    "🇸🇪 Old Same CID"                  // Same filterIds Tier 2 -> matches both
                ],
                [], [], false, [], [], [],
                [], [], [], false, [], [], []
            );

            let exc = resolver.filter_candidate_outbounds(
                "exclude", ["t_exact", "t_alias", "t_canon"], names, {}, metadata,
                [], [], [], false, [], [], [],
                ["🇫🇮 Finland Promo Old Name", "🇩🇪 Frankfurt #3 🟢 | 1.0 GB"],
                [], [], false, [], [], []
            );

            print(sprintf("%J", { inc, exc }));
            """
        )
        self.assertEqual(res["inc"], ["t_exact", "t_alias", "t_canon", "t_dup1", "t_dup2"])
        self.assertEqual(res["exc"], ["t_exact"])

    def test_selection_supports_endpoints_and_canonical_stem_fallback(self):
        choices_file = self.dir / "selections.json"
        cfg_v1 = {
            "outbounds": [
                {"type": "selector", "tag": "main-out", "outbounds": ["wg-ep-1", "🇩🇪 DE #1 🟢 | 10 GB"], "default": "🇩🇪 DE #1 🟢 | 10 GB"},
                {"type": "vless", "tag": "🇩🇪 DE #1 🟢 | 10 GB", "server": "de-old.example", "server_port": 443, "uuid": "u1"},
            ],
            "endpoints": [
                {
                    "type": "wireguard",
                    "tag": "wg-ep-1",
                    "address": ["10.0.0.2/32"],
                    "private_key": "priv1==",
                    "peers": [{"address": "198.51.100.1", "port": 51820, "public_key": "pub1=="}],
                }
            ],
        }
        # Test 1: remember & apply a WireGuard endpoint across rename!
        cfg_wg_renamed = json.loads(json.dumps(cfg_v1))
        cfg_wg_renamed["outbounds"][0]["outbounds"] = ["wg-ep-renamed", "🇩🇪 DE #1 🟢 | 10 GB"]
        cfg_wg_renamed["endpoints"][0]["tag"] = "wg-ep-renamed"

        res_wg = run_ucode(
            """
            let sel = require("service.selection");
            let r = sel.remember("main-out", "wg-ep-1", json(ARGV[0]), "manual");
            let applied = sel.apply(json(ARGV[1]));
            print(sprintf("%J", { r, def: applied.outbounds[0].default }));
            """,
            json.dumps(cfg_v1),
            json.dumps(cfg_wg_renamed),
            env_overrides={"FORKOP_SELECTION_FILE": str(choices_file), "PATH": ""},
        )
        self.assertTrue(res_wg["r"]["success"])
        self.assertEqual(res_wg["def"], "wg-ep-renamed")

        # Test 2: canonical_label fallback when BOTH exact tag and server changed slightly, stem stays unique
        cfg_v2_rotated = {
            "outbounds": [
                {"type": "selector", "tag": "main-out", "outbounds": ["wg-ep-1", "🇩🇪 DE #1 🔴 | 42.5 GB"], "default": "wg-ep-1"},
                {"type": "vless", "tag": "🇩🇪 DE #1 🔴 | 42.5 GB", "server": "de-new.example", "server_port": 443, "uuid": "u1"},
            ],
            "endpoints": cfg_v1["endpoints"],
        }
        res_stem = run_ucode(
            """
            let sel = require("service.selection");
            let r = sel.remember("main-out", "🇩🇪 DE #1 🟢 | 10 GB", json(ARGV[0]), "manual");
            let applied = sel.apply(json(ARGV[1]));
            print(sprintf("%J", { r, def: applied.outbounds[0].default }));
            """,
            json.dumps(cfg_v1),
            json.dumps(cfg_v2_rotated),
            env_overrides={"FORKOP_SELECTION_FILE": str(choices_file), "PATH": ""},
        )
        self.assertTrue(res_stem["r"]["success"])
        self.assertEqual(res_stem["def"], "🇩🇪 DE #1 🔴 | 42.5 GB")


if __name__ == "__main__":
    unittest.main()
