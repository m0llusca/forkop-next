"""Real nft CLI guards must recognize a complete rule and a default local route.

Linux CI runs ucode; only the external ip command is replaced. These checks do
not touch the machine's routing tables or firewall.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from test_next_profiles import LIB


class NetworkRuleGuards(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        ip = directory / 'ip'
        ip.write_text('''#!/bin/sh
case "$*" in
  "-4 rule list"|"-6 rule list") printf '%s\\n' "$FORKOP_TEST_RULES" ;;
  "route list table forkop"|"-6 route list table forkop") printf '%s\\n' "$FORKOP_TEST_ROUTES" ;;
  *) printf 'Unexpected ip command: %s\\n' "$*" >&2; exit 99 ;;
esac
''')
        ip.chmod(0o700)
        self.env = dict(os.environ, FORKOP_LIB=str(LIB),
                        PATH=str(directory) + os.pathsep + os.environ['PATH'])

    def check_guard(self, mode, expected, *, rules='', routes=''):
        args = ['ucode', '-L', str(LIB), str(LIB / 'nft/apply.uc'), mode, 'forkop']
        if 'marking-rule' in mode:
            args.append('0x00100000')
        result = subprocess.run(args, env=dict(self.env, FORKOP_TEST_RULES=rules,
                                              FORKOP_TEST_ROUTES=routes),
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0 if expected else 1,
                         f'{mode}: {result.stdout}{result.stderr}')

    def test_mark_and_table_on_same_rule_are_present_for_both_families(self):
        for family in (4, 6):
            with self.subTest(family=family):
                self.check_guard(f'tproxy-marking-rule{family}-present', True,
                                 rules='105: from all fwmark 0x100000/0x100000 lookup forkop')

    def test_separate_mark_and_table_rules_are_absent_in_both_orders(self):
        unrelated = ['100: from all fwmark 0x200000/0x200000 lookup forkop',
                     '105: from all fwmark 0x100000/0x100000 lookup other']
        for family in (4, 6):
            for lines in (unrelated, list(reversed(unrelated))):
                with self.subTest(family=family, lines=lines):
                    self.check_guard(f'tproxy-marking-rule{family}-present', False,
                                     rules='\n'.join(lines))

    def test_constrained_rule_does_not_replace_universal_mark_rule(self):
        restrictions = {
            4: ('from 192.0.2.0/24', 'from all iif br-lan',
                'from all to 192.0.2.0/24'),
            6: ('from 2001:db8::/64', 'from all iif br-lan',
                'from all to 2001:db8::/64'),
        }
        for family, selectors in restrictions.items():
            for selector in selectors:
                with self.subTest(family=family, selector=selector):
                    self.check_guard(f'tproxy-marking-rule{family}-present', False,
                                     rules=f'105: {selector} fwmark 0x100000/0x100000 lookup forkop')

    def test_universal_rule_with_protocol_metadata_is_present(self):
        for family in (4, 6):
            with self.subTest(family=family):
                self.check_guard(f'tproxy-marking-rule{family}-present', True,
                                 rules='105: from all fwmark 0x100000/0x100000 lookup forkop proto static')

    def test_ipv6_default_local_route_is_present(self):
        for route in ('local default dev lo metric 1024 pref medium',
                      'local ::/0 dev lo metric 1024 pref medium'):
            with self.subTest(route=route):
                self.check_guard('tproxy-route6-present', True, routes=route)

    def test_ipv6_host_and_prefix_routes_do_not_replace_default_route(self):
        for route in ('local ::1 dev lo proto kernel metric 0 pref medium',
                      'local ::1/128 dev lo metric 1024 pref medium',
                      'local ::/64 dev lo metric 1024 pref medium'):
            with self.subTest(route=route):
                self.check_guard('tproxy-route6-present', False, routes=route)

    def test_ipv6_default_on_different_interface_is_absent(self):
        self.check_guard('tproxy-route6-present', False,
                         routes='local default dev lo0 metric 1024 pref medium')

    def test_ipv4_default_local_route_is_present(self):
        self.check_guard('tproxy-route4-present', True,
                         routes='local default dev lo scope host')

    def test_ipv4_default_on_different_interface_is_absent(self):
        self.check_guard('tproxy-route4-present', False,
                         routes='local default dev lo0 scope host')
