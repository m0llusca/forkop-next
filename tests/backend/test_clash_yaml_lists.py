"""Behavioral tests for Pack 2B: Clash rule-provider YAML import in routing/rulesets.uc
and components/updates.uc (merging with .lst rules, domains_only, and sing-box check).
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "forkop/files/usr/lib"
SB_BIN = Path("/home/antigravity/.cache/forkop-dev/forkop-cores/sing-box-1.14.3-linux-amd64/sing-box")


def ucode_env(extra=None):
    env = dict(os.environ)
    local_bin = str(Path.home() / ".local/bin")
    local_lib = str(Path.home() / ".local/lib")
    local_lib64 = str(Path.home() / ".local/lib64")
    env["PATH"] = f"{local_bin}:{env.get('PATH', '')}"
    env["LD_LIBRARY_PATH"] = f"{local_lib}:{local_lib64}:{env.get('LD_LIBRARY_PATH', '')}"
    env["FORKOP_LIB"] = str(LIB)
    if extra:
        env.update(extra)
    return env


def ucode_bin():
    cand = Path.home() / ".local/bin/ucode"
    return str(cand) if cand.exists() else "ucode"


class ClashYamlListsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_detect_and_parse_classical_domain_and_ipcidr_clash_yaml(self):
        yaml_text = """# Clash rule-provider fixture
---
payload:
  - DOMAIN,api.example.com
  - DOMAIN-SUFFIX,cdn.example.org,PROXY
  - DOMAIN-KEYWORD,streammedia
  - 'IP-CIDR,203.0.113.0/24,no-resolve'
  - "IP-CIDR6,2001:db8:abcd::/48,no-resolve"
  - PROCESS-NAME,telegram-desktop
  - DST-PORT,8443
  - GEOIP,RU
  - MATCH,DIRECT
  - '+.plus.example.net'
  - '.subonly.example.net'
  - '*.wild.example.net'
  - bare.example.net # trailing comment
  - 198.51.100.7
  - 2001:db8::9
"""
        plain_lst = "example.com\n1.1.1.0/24\n2606:4700::/32\n"
        proc = subprocess.run(
            [
                ucode_bin(),
                "-L",
                str(LIB),
                "-e",
                """
                let rs = require("routing.rulesets");
                print(sprintf("%J", {
                    is_yaml: rs.content_is_clash_rule_yaml(ARGV[0]),
                    is_rules: rs.content_is_clash_rule_yaml("---\\nrules:\\n  - DOMAIN,a.com\\n"),
                    is_plain: rs.content_is_clash_rule_yaml(ARGV[1]),
                    parsed_all: rs.parse_clash_rule_entries(ARGV[0], false),
                    parsed_dns: rs.parse_clash_rule_entries(ARGV[0], true)
                }));
                """,
                yaml_text,
                plain_lst,
            ],
            env=ucode_env(),
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(data["is_yaml"])
        self.assertTrue(data["is_rules"])
        self.assertFalse(data["is_plain"])

        all_entries = data["parsed_all"]
        self.assertIn("api.example.com", all_entries["domain"])
        self.assertIn("bare.example.net", all_entries["domain"])
        self.assertIn("cdn.example.org", all_entries["domain_suffix"])
        self.assertIn("plus.example.net", all_entries["domain_suffix"])
        self.assertIn(".subonly.example.net", all_entries["domain_suffix"])
        self.assertEqual(all_entries["domain_keyword"], ["streammedia"])
        self.assertEqual(all_entries["domain_regex"], [r"^[^.]+\.wild\.example\.net$"])
        self.assertCountEqual(
            all_entries["ip_cidr"],
            ["203.0.113.0/24", "2001:db8:abcd::/48", "198.51.100.7/32", "2001:db8::9/128"],
        )
        self.assertEqual(data["parsed_dns"]["ip_cidr"], [])

    def test_import_clash_yaml_merges_without_overwriting_existing_lst_rules_and_compiles(self):
        plain_path = self.dir / "base.lst"
        plain_path.write_text("existing-from-lst.example\n")
        yaml_path = self.dir / "provider.yaml"
        yaml_path.write_text(
            "payload:\n"
            "  - '+.merged.example'\n"
            "  - '*.edge.example'\n"
            "  - DOMAIN,exact.example\n"
            "  - DOMAIN-KEYWORD,kwtest\n"
            "  - IP-CIDR,192.0.2.0/24,no-resolve\n"
            "  - 198.51.100.42\n"
        )
        ruleset_path = self.dir / "ruleset.json"
        subnets_out = self.dir / "subnets.lst"

        for args in [
            ["create-source", str(ruleset_path)],
            ["import-plain-list", str(plain_path), str(ruleset_path), "domain_suffix", "domains", "5000"],
            ["import-clash-yaml", str(yaml_path), str(ruleset_path), str(subnets_out), "0"],
        ]:
            p = subprocess.run(
                [ucode_bin(), "-L", str(LIB), str(LIB / "routing/rulesets.uc"), *args],
                env=ucode_env(),
                capture_output=True,
                text=True,
            )
            self.assertEqual(p.returncode, 0, p.stderr)

        rs_json = json.loads(ruleset_path.read_text())
        merged_suffixes = []
        merged_domains = []
        merged_regex = []
        merged_cidrs = []
        for r in rs_json["rules"]:
            merged_suffixes.extend(r.get("domain_suffix", []))
            merged_domains.extend(r.get("domain", []))
            merged_regex.extend(r.get("domain_regex", []))
            merged_cidrs.extend(r.get("ip_cidr", []))

        self.assertIn("existing-from-lst.example", merged_suffixes)
        self.assertIn("merged.example", merged_suffixes)
        self.assertEqual(merged_domains, ["exact.example"])
        self.assertEqual(merged_regex, [r"^[^.]+\.edge\.example$"])
        self.assertCountEqual(merged_cidrs, ["192.0.2.0/24", "198.51.100.42/32"])
        self.assertCountEqual(subnets_out.read_text().splitlines(), ["192.0.2.0/24", "198.51.100.42/32"])

        if SB_BIN.exists():
            srs_path = self.dir / "ruleset.srs"
            comp = subprocess.run(
                [str(SB_BIN), "rule-set", "compile", "--output", str(srs_path), str(ruleset_path)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(comp.returncode, 0, comp.stderr)
            self.assertTrue(srs_path.exists() and srs_path.stat().st_size > 0)

    def test_updates_uc_imports_extensionless_clash_yaml_and_respects_dns_domains_only(self):
        plain_file = self.dir / "first.lst"
        plain_file.write_text("from-plain.example\n")
        extless_yaml = self.dir / "downloaded_rule_provider_blob"
        extless_yaml.write_text(
            "# Extensionless remote rule-provider\n"
            "payload:\n"
            "  - '+.clash-blob.example'\n"
            "  - IP-CIDR,203.0.113.128/25,no-resolve\n"
        )
        tmp_rs_dir = self.dir / "rulesets"
        tmp_rs_dir.mkdir()
        uci_state = self.dir / "uci.state"
        uci_state.write_text(
            "forkop.dnssec=section\n"
            "forkop.dnssec.enabled=1\n"
            "forkop.dnssec.action=dns\n"
            f"forkop.dnssec.domain_ip_lists={plain_file} {extless_yaml}\n"
        )
        # Stub nft command only if called; for action=dns, nft must not even be needed for subnets
        proc = subprocess.run(
            [
                ucode_bin(),
                "-L",
                str(LIB),
                str(LIB / "components/updates.uc"),
                "list-update",
            ],
            env=ucode_env(
                {
                    "FORKOP_UCI_STATE_FILE": str(uci_state),
                    "TMP_SING_BOX_FOLDER": str(self.dir / "sb"),
                    "TMP_RULESET_FOLDER": str(tmp_rs_dir),
                    "FORKOP_RUNTIME_STATE_DIR": str(self.dir / "run"),
                    "FORKOP_LIST_UPDATE_PID_FILE": str(self.dir / "list.pid"),
                }
            ),
            capture_output=True,
            text=True,
        )
        rs_file = tmp_rs_dir / "dnssec-lists-ruleset.json"
        self.assertTrue(rs_file.exists(), f"Expected {rs_file} to exist; stderr={proc.stderr}")
        rs_data = json.loads(rs_file.read_text())
        suffixes = [s for r in rs_data["rules"] for s in r.get("domain_suffix", [])]
        cidrs = [c for r in rs_data["rules"] for c in r.get("ip_cidr", [])]
        self.assertIn("from-plain.example", suffixes)
        self.assertIn("clash-blob.example", suffixes)
        self.assertEqual(cidrs, [], "action == 'dns' must skip ip_cidr entries")


if __name__ == "__main__":
    unittest.main()
