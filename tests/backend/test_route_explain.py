"""Behavioral route decisions. Run with Python 3 and an OpenWrt ucode runtime."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "forkop/files/usr/lib"
MODULE = LIB / "service/route_explain.uc"


class RouteExplainTests(unittest.TestCase):
    def explain(self, sections=(), request=None, settings=None):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "uci.state"
            lines = ["forkop.settings=settings"]
            for key, value in (settings or {}).items():
                lines.append(f"forkop.settings.{key}={value}")
            for name, options in sections:
                lines.append(f"forkop.{name}=section")
                for key, value in {"enabled": "1", "action": "connection", **options}.items():
                    lines.append(f"forkop.{name}.{key}={value}")
            state.write_text("\n".join(lines) + "\n", encoding="utf-8")
            before = state.read_bytes()
            env = {**os.environ, "FORKOP_UCI_STATE_FILE": str(state)}
            result = subprocess.run([os.environ.get("UCODE", "ucode"), "-L", str(LIB),
                                     str(MODULE), "explain", json.dumps(request or {"domain": "example.com"})],
                                    env=env, text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(state.read_bytes(), before, "explaining a route must never mutate UCI")
            return json.loads(result.stdout)

    def test_suffix_matches_subdomain_but_not_unrelated_name(self):
        # Catches substring matching instead of DNS-label boundary matching.
        sections = [("main", {"domain_suffix": "example.com"})]
        self.assertEqual(self.explain(sections, {"domain": "www.example.com"})["data"]["decision"]["section"], "main")
        self.assertEqual(self.explain(sections, {"domain": "notexample.com"})["data"]["decision"]["status"], "direct")

    def test_full_domain_is_exact_and_normalizes_case(self):
        sections = [("main", {"domain_suffix": "full:example.com"})]
        self.assertEqual(self.explain(sections, {"domain": "EXAMPLE.COM."})["data"]["decision"]["section"], "main")
        self.assertEqual(self.explain(sections, {"domain": "www.example.com"})["data"]["decision"]["status"], "direct")

    def test_first_section_wins_and_disabled_sections_do_not_match(self):
        result = self.explain([("off", {"enabled": "0", "domain_suffix": "example.com"}),
                               ("first", {"domain_suffix": "example.com", "action": "bypass"}),
                               ("later", {"domain_suffix": "example.com", "action": "block"})])["data"]
        self.assertEqual(result["decision"], {"status": "direct", "section": "first", "outbound": "bypass-out"})
        self.assertFalse(result["connectivity_tested"])
        self.assertEqual(result["scope"], "configured")

    def test_unknown_earlier_ruleset_prevents_false_later_certainty(self):
        data = self.explain([("remote", {"rule_set": "https://example.net/list.srs"}),
                             ("later", {"domain_suffix": "example.com"})])["data"]
        self.assertEqual(data["decision"]["status"], "indeterminate")
        self.assertIn("rule_set", data["missing"])

    def test_port_is_and_guard_and_missing_port_stays_unknown(self):
        sections = [("main", {"domain_suffix": "example.com", "ports": "443 8000-8010"})]
        self.assertEqual(self.explain(sections, {"domain": "example.com", "port": 8001})["data"]["decision"]["section"], "main")
        self.assertEqual(self.explain(sections, {"domain": "example.com", "port": 80})["data"]["decision"]["status"], "direct")
        self.assertEqual(self.explain(sections)["data"]["decision"]["status"], "indeterminate")

    def test_device_fully_routed_rule_precedes_its_domain_guard(self):
        sections = [("main", {"fully_routed_ips": "192.168.1.2", "domain_suffix": "other.example"})]
        self.assertEqual(self.explain(sections, {"domain": "example.com", "device": "192.168.1.2"})["data"]["decision"]["section"], "main")

    def test_source_guard_rejects_nonmatching_device_before_unknown_set(self):
        sections = [("main", {"source_ip_cidr": "192.168.1.2", "rule_set": "remote"})]
        self.assertEqual(self.explain(sections, {"domain": "example.com", "device": "192.168.1.3"})["data"]["decision"]["status"], "direct")

    def test_ntp_exclusion_precedes_section_and_block_is_distinct(self):
        sections = [("main", {"domain_suffix": "example.com", "action": "block"})]
        data = self.explain(sections, {"domain": "example.com", "port": 123, "protocol": "udp"}, {"exclude_ntp": "1"})["data"]
        self.assertEqual(data["decision"]["status"], "direct")
        self.assertEqual(data["trace"][0]["reason"], "exclude_ntp")
        self.assertEqual(self.explain(sections)["data"]["decision"]["status"], "blocked")

    def test_permanent_shadow_rule_with_zero_expiry_remains_active(self):
        for kind in ['gaming','recommendation']:
            with self.subTest(kind=kind):
                sections=[('nxt_permanent', {'domain_suffix':'example.com','next_kind':kind,'next_target':'main','next_expires':'0'}),
                          ('main', {'domain_suffix':'different.example'})]
                result=self.explain(sections)['data']['decision']
                self.assertEqual(result['status'],'matched')
                self.assertEqual(result['outbound'],'main-out')

    def test_internal_ip_check_domain_explains_generated_service_override(self):
        result=self.explain([('main', {'domain_suffix':'other.example'})],{'domain':'ip.podkop.fyi'})['data']
        self.assertEqual(result['decision']['outbound'],'main-out')
        self.assertEqual(result['trace'][0]['reason'],'service_ip_check')

    def test_invalid_inputs_are_rejected(self):
        for request in ({"domain": "https://example.com"}, {"domain": "example.com", "port": 0},
                        {"domain": "example.com", "device": "; reboot"}, {"domain": "example.com", "protocol": "bogus"}):
            result = self.explain(request=request)
            self.assertFalse(result["success"])
            self.assertEqual(result["error"], "invalid_request")

    def test_expired_temporary_rule_does_not_shadow_later_rule(self):
        sections = [("expired", {"domain_suffix": "example.com", "action": "block", "next_kind": "temporary", "next_expires": "1"}),
                    ("main", {"domain_suffix": "example.com"})]
        data = self.explain(sections)["data"]
        self.assertEqual(data["decision"]["section"], "main")
        self.assertEqual(data["trace"][0]["reason"], "expired")

    def test_temporary_rule_routes_to_existing_target(self):
        data = self.explain([("temporary", {"domain_suffix": "example.com", "next_target": "main", "next_kind": "temporary"}),
                             ("main", {"domain_suffix": "other.example"})])["data"]
        self.assertEqual(data["decision"]["outbound"], "main-out")

    def test_ipv4_cidr_source_guard_includes_network_boundaries(self):
        sections = [("main", {"domain_suffix": "example.com", "source_ip_cidr": "192.168.1.0/24"})]
        for device in ("192.168.1.0", "192.168.1.255"):
            self.assertEqual(self.explain(sections, {"domain": "example.com", "device": device})["data"]["decision"]["section"], "main")
        self.assertEqual(self.explain(sections, {"domain": "example.com", "device": "192.168.2.0"})["data"]["decision"]["status"], "direct")


if __name__ == "__main__":
    unittest.main()
