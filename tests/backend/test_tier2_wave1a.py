import json
import os
import signal
import stat
import subprocess
import tempfile
import textwrap
import time
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FORKOP_LIB = REPO_ROOT / 'forkop/files/usr/lib'


def runtime_env(extra=None):
    env = os.environ.copy()
    local_bin = str(Path.home() / '.local/bin')
    local_lib = str(Path.home() / '.local/lib')
    local_lib64 = str(Path.home() / '.local/lib64')
    env['PATH'] = f"{local_bin}:{env.get('PATH', '')}"
    ld_existing = env.get('LD_LIBRARY_PATH', '')
    env['LD_LIBRARY_PATH'] = f"{local_lib}:{local_lib64}" + (f":{ld_existing}" if ld_existing else '')
    env['FORKOP_LIB'] = str(FORKOP_LIB)
    if extra:
        env.update(extra)
    return env


def run_ucode(args, extra_env=None, check=False):
    cmd = ['ucode', '-L', str(FORKOP_LIB)] + [str(a) for a in args]
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env=runtime_env(extra_env),
        text=True,
        capture_output=True,
        check=check,
    )


def write_executable(path: Path, body: str):
    path.write_text(body, encoding='utf-8')
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


class Wave1ABehavioralTests(unittest.TestCase):
    def test_fakeip6_constants_are_rfc5180_2001_2_112(self):
        core_proc = run_ucode([FORKOP_LIB / 'core/constants.uc', 'get', 'SB_FAKEIP_INET6_RANGE'], check=True)
        sb_proc = run_ucode(['-e', 'printf("%s\\n", require("singbox.constants").FAKEIP_INET6_RANGE);'], check=True)
        self.assertEqual(core_proc.stdout.strip(), '2001:2::/112')
        self.assertEqual(sb_proc.stdout.strip(), '2001:2::/112')

    def test_country_public_ipv6_excludes_rfc5180_benchmarking_block(self):
        for non_public in ('2001:2::1', '2001:2::ffff', '2001:2:0:ffff::1', 'fc00::1', '2001:db8::1'):
            proc = run_ucode(['-e', f'exit(require("singbox.country").public_ip({json.dumps(non_public)}) ? 0 : 1);'])
            self.assertNotEqual(proc.returncode, 0, f'{non_public} must not be treated as public IPv6')

        public_proc = run_ucode(['-e', 'exit(require("singbox.country").public_ip("2606:4700:4700::1111") ? 0 : 1);'])
        self.assertEqual(public_proc.returncode, 0, public_proc.stderr)

    def test_diagnostics_check_fakeip_uses_rfc5180_cidr_instead_of_fc00_regex(self):
        runtime_uc = FORKOP_LIB / 'diagnostics/runtime.uc'
        with tempfile.TemporaryDirectory() as tmp:
            bin_dir = Path(tmp) / 'bin'
            bin_dir.mkdir()
            write_executable(
                bin_dir / 'dig',
                textwrap.dedent("""\
                    #!/bin/sh
                    for arg in "$@"; do
                        if [ "$arg" = "AAAA" ]; then
                            printf '%s\\n' "${MOCK_AAAA:-}"
                            exit 0
                        fi
                    done
                    printf '%s\\n' "${MOCK_A:-}"
                    exit 0
                """),
            )
            base_path = f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}"

            proc_rfc5180 = run_ucode(
                [runtime_uc, 'check-fakeip'],
                extra_env={'PATH': base_path, 'MOCK_A': '', 'MOCK_AAAA': '2001:2::1234'},
            )
            self.assertEqual(proc_rfc5180.returncode, 0, proc_rfc5180.stderr)
            res_rfc5180 = json.loads(proc_rfc5180.stdout)
            self.assertTrue(res_rfc5180['fakeip'])
            self.assertEqual(res_rfc5180['IPv6'], '2001:2::1234')

            proc_legacy = run_ucode(
                [runtime_uc, 'check-fakeip'],
                extra_env={'PATH': base_path, 'MOCK_A': '', 'MOCK_AAAA': 'fc00::1234'},
            )
            self.assertEqual(proc_legacy.returncode, 0, proc_legacy.stderr)
            res_legacy = json.loads(proc_legacy.stdout)
            self.assertFalse(res_legacy['fakeip'])

    def test_nft_default_fakeip6_range_and_priority_104_source_check_rule(self):
        nft_uc = FORKOP_LIB / 'nft/apply.uc'
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            nft_log = tmp_path / 'nft.log'
            ip_log = tmp_path / 'ip.log'
            rt_tables = tmp_path / 'rt_tables'
            rt_tables.write_text('255\tlocal\n254\tmain\n', encoding='utf-8')

            write_executable(
                bin_dir / 'nft',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "$1" = "-f" ]; then
                        cat "$2" >> "{nft_log}"
                        exit 0
                    fi
                    printf 'nft %s\\n' "$*" >> "{nft_log}"
                    exit 0
                """),
            )
            write_executable(
                bin_dir / 'ip',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "$1" = "-4" ] && [ "$2" = "rule" ] && [ "$3" = "list" ]; then
                        printf '%s\\n' "${{MOCK_IP4_RULES:-}}"
                        exit 0
                    fi
                    if [ "$1" = "-6" ] && [ "$2" = "rule" ] && [ "$3" = "list" ]; then
                        printf '%s\\n' "${{MOCK_IP6_RULES:-}}"
                        exit 0
                    fi
                    if [ "$1" = "route" ] && [ "$2" = "list" ]; then
                        printf '%s\\n' "${{MOCK_IP4_ROUTES:-}}"
                        exit 0
                    fi
                    if [ "$1" = "-4" ] && [ "$2" = "route" ] && [ "$3" = "list" ]; then
                        printf '%s\\n' "${{MOCK_IP4_ROUTES:-}}"
                        exit 0
                    fi
                    if [ "$1" = "-6" ] && [ "$2" = "route" ] && [ "$3" = "list" ]; then
                        printf '%s\\n' "${{MOCK_IP6_ROUTES:-}}"
                        exit 0
                    fi
                    printf 'ip %s\\n' "$*" >> "{ip_log}"
                    exit 0
                """),
            )

            fixture = tmp_path / 'empty.json'
            fixture.write_text(json.dumps({
                'section': [
                    {
                        '.name': 'byp',
                        'enabled': '1',
                        'action': 'bypass',
                        'fully_routed_ips': ['2001:db8:10::1'],
                    }
                ],
            }), encoding='utf-8')

            env_base = {'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}"}
            proc_base = run_ucode([
                nft_uc, 'nft-create-runtime-base',
                'ForkopTable', 'localv4', 'forkop_subnets', 'forkop_ports',
                'forkop_ip_ports', 'forkop_masq_ifaces', 'br-lan',
                '0x00100000', '0x08000000', '198.18.0.0/15', '1602', '0',
            ], extra_env=env_base)
            self.assertEqual(proc_base.returncode, 0, proc_base.stderr)
            proc_out = run_ucode([
                nft_uc, 'nft-create-runtime-output-rules',
                'ForkopTable', 'localv4', 'forkop_subnets', 'forkop_ports',
                'forkop_ip_ports', '0x00100000', '198.18.0.0/15',
            ], extra_env=env_base)
            self.assertEqual(proc_out.returncode, 0, proc_out.stderr)
            proc_sec = run_ucode([
                nft_uc, 'nft-add-section-priority-rules-fixture',
                fixture, 'ForkopTable', 'forkop_masq_ifaces', 'localv4', 'localv6', '0x00100000', '198.18.0.0/15',
            ], extra_env=env_base)
            self.assertEqual(proc_sec.returncode, 0, proc_sec.stderr)
            rendered = nft_log.read_text(encoding='utf-8')
            self.assertIn('2001:2::/112', rendered)
            self.assertNotIn('fc00::/18', rendered)

            valid_104 = '104:\tfrom all fwmark 0x100000/0x100000 iif lo lookup main'
            for good in (valid_104, valid_104 + ' proto static', '104:\tfrom all iif lo fwmark 0x100000/0xffffffff table main'):
                res = run_ucode(
                    [nft_uc, 'source-check-rule4-present', '0x00100000'],
                    extra_env={**env_base, 'MOCK_IP4_RULES': good},
                )
                self.assertEqual(res.returncode, 0, f'Expected valid priority 104 rule: {good}')

            for bad in (
                '105:\tfrom all fwmark 0x100000/0x100000 iif lo lookup main',
                '104:\tfrom all fwmark 0x100000/0x100000 lookup main',
                '104:\tfrom all fwmark 0x100000/0x100000 iif br-lan lookup main',
                '104:\tfrom all fwmark 0x100000/0x100000 iif lo lookup forkop',
                '104:\tfrom all to 198.51.100.0/24 fwmark 0x100000/0x100000 iif lo lookup main',
                '104:\tfrom all fwmark 0x100000/0x100000 iif lo oif eth0 lookup main',
                '104:\tfrom all fwmark 0x100000/0x0f0000 iif lo lookup main',
            ):
                res = run_ucode(
                    [nft_uc, 'source-check-rule4-present', '0x00100000'],
                    extra_env={**env_base, 'MOCK_IP4_RULES': bad},
                )
                self.assertNotEqual(res.returncode, 0, f'Expected invalid priority 104 rule rejected: {bad}')

            missing_104_env = {
                **env_base,
                'MOCK_IP4_RULES': '105:\tfrom all fwmark 0x100000/0x100000 lookup forkop',
                'MOCK_IP6_RULES': '105:\tfrom all fwmark 0x100000/0x100000 lookup forkop',
                'MOCK_IP4_ROUTES': 'local default dev lo scope host',
                'MOCK_IP6_ROUTES': 'local default dev lo metric 1024 pref medium',
            }
            present_missing = run_ucode(
                [nft_uc, 'tproxy-route-rule-present', 'forkop', '0x00100000'],
                extra_env=missing_104_env,
            )
            self.assertNotEqual(present_missing.returncode, 0, 'tproxy-route-rule-present must require priority 104 rule')

            # Ensure-tproxy-route-rule adds priority 104 when missing (mock ip records add and then rule list reflects it)
            state_rules = tmp_path / 'ip4_rules.txt'
            state_rules.write_text('105:\tfrom all fwmark 0x100000/0x100000 lookup forkop\n', encoding='utf-8')
            write_executable(
                bin_dir / 'ip',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "$1" = "-4" ] && [ "$2" = "rule" ] && [ "$3" = "list" ]; then
                        cat "{state_rules}"
                        exit 0
                    fi
                    if [ "$1" = "-6" ] && [ "$2" = "rule" ] && [ "$3" = "list" ]; then
                        printf '105:\\tfrom all fwmark 0x100000/0x100000 lookup forkop\\n'
                        exit 0
                    fi
                    if ( [ "$1" = "route" ] && [ "$2" = "list" ] ) || ( [ "$2" = "route" ] && [ "$3" = "list" ] ); then
                        printf 'local default dev lo scope host\\n'
                        exit 0
                    fi
                    printf 'ip %s\\n' "$*" >> "{ip_log}"
                    if [ "$1" = "-4" ] && [ "$2" = "rule" ] && [ "$3" = "add" ]; then
                        printf '104:\\tfrom all fwmark 0x100000/0x100000 iif lo lookup main\\n' >> "{state_rules}"
                    fi
                    exit 0
                """),
            )
            ensure_res = run_ucode(
                [nft_uc, 'ensure-tproxy-route-rule', 'forkop', '0x00100000', rt_tables],
                extra_env=env_base,
            )
            self.assertEqual(ensure_res.returncode, 0, ensure_res.stderr)
            self.assertIn(
                'ip -4 rule add iif lo fwmark 0x00100000/0x00100000 lookup main priority 104',
                ip_log.read_text(encoding='utf-8'),
            )
            present_ok = run_ucode(
                [nft_uc, 'tproxy-route-rule-present', 'forkop', '0x00100000'],
                extra_env=env_base,
            )
            self.assertEqual(present_ok.returncode, 0, present_ok.stderr)

    def test_console_gaming_mode_nft_rules_signatures_and_route_explain(self):
        nft_uc = FORKOP_LIB / 'nft/apply.uc'
        state_uc = FORKOP_LIB / 'service/state.uc'
        explain_uc = FORKOP_LIB / 'service/route_explain.uc'

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            nft_log = tmp_path / 'nft.log'
            write_executable(
                bin_dir / 'nft',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "$1" = "-f" ]; then
                        cat "$2" >> "{nft_log}"
                        exit 0
                    fi
                    printf '%s\\n' "$*" >> "{nft_log}"
                    exit 0
                """),
            )
            env_base = {'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}"}

            section_console = {
                '.name': 'ps5',
                '.type': 'section',
                'enabled': '1',
                'action': 'proxy',
                'console_mode': '1',
                'selector_proxy_links': ['vless://00000000-0000-0000-0000-000000000001@198.51.100.10:443?security=none#PS5'],
                'fully_routed_ips': ['192.168.1.50', '2001:db8:1::50'],
                'ip_cidr': ['203.0.113.0/24', '2001:4860:4860::/48'],
                'ports': ['3074'],
            }
            nft_fixture_on = tmp_path / 'console-on.json'
            nft_fixture_on.write_text(json.dumps({
                'settings': {},
                'section': [section_console],
                'sections': [section_console],
                'interfaces': ['br-lan'],
            }), encoding='utf-8')

            section_normal = dict(section_console, console_mode='0')
            nft_fixture_off = tmp_path / 'console-off.json'
            nft_fixture_off.write_text(json.dumps({
                'settings': {},
                'section': [section_normal],
                'sections': [section_normal],
                'interfaces': ['br-lan'],
            }), encoding='utf-8')

            proc = run_ucode([
                nft_uc, 'nft-add-section-priority-rules-fixture',
                nft_fixture_on, 'ForkopTable', 'forkop_masq_ifaces', 'localv4', 'localv6', '0x00100000', '198.18.0.0/15',
            ], extra_env=env_base)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            rules = nft_log.read_text(encoding='utf-8')

            # Console fully_routed_ips marks TCP and fast-paths non-FakeIP UDP without mark
            self.assertIn(
                'add rule inet ForkopTable priority_rules iifname @forkop_masq_ifaces ip saddr @forkop_rule_ps5_fully_sources ip daddr != @localv4 meta l4proto tcp meta mark set 0x00100000 counter accept',
                rules,
            )
            self.assertIn(
                'add rule inet ForkopTable priority_rules iifname @forkop_masq_ifaces ip saddr @forkop_rule_ps5_fully_sources ip daddr != @localv4 ip daddr != 198.18.0.0/15 meta l4proto udp counter accept',
                rules,
            )
            self.assertIn(
                'add rule inet ForkopTable priority_rules iifname @forkop_masq_ifaces ip6 saddr @forkop_rule_ps5_fully_sources6 ip6 daddr != @localv6 meta l4proto tcp meta mark set 0x00100000 counter accept',
                rules,
            )
            self.assertIn(
                'add rule inet ForkopTable priority_rules iifname @forkop_masq_ifaces ip6 saddr @forkop_rule_ps5_fully_sources6 ip6 daddr != @localv6 ip6 daddr != 2001:2::/112 meta l4proto udp counter accept',
                rules,
            )
            # Console section subnet/port rules must only mark TCP, never UDP
            for line in rules.splitlines():
                if 'ps5' in line and 'meta mark set' in line:
                    self.assertNotIn('udp', line, f'Console mode must not mark UDP: {line}')
                    self.assertIn('tcp', line, f'Console mode mark rule must restrict to TCP: {line}')

            # Signature parity and toggle sensitivity
            sig_apply_on = run_ucode([nft_uc, 'nft-runtime-signature-fixture', nft_fixture_on], check=True).stdout.strip()
            sig_state_on = run_ucode([state_uc, 'nft-signature-fixture', nft_fixture_on], check=True).stdout.strip()
            sig_apply_off = run_ucode([nft_uc, 'nft-runtime-signature-fixture', nft_fixture_off], check=True).stdout.strip()
            sig_state_off = run_ucode([state_uc, 'nft-signature-fixture', nft_fixture_off], check=True).stdout.strip()
            self.assertEqual(sig_apply_on, sig_state_on)
            self.assertEqual(sig_apply_off, sig_state_off)
            self.assertNotEqual(sig_apply_on, sig_apply_off)

            # Route explain for console_mode
            uci_state = tmp_path / 'uci.state'
            uci_state.write_text(textwrap.dedent("""\
                forkop.settings=settings
                forkop.settings.dns_server=1.1.1.1
                forkop.ps5=section
                forkop.ps5.enabled=1
                forkop.ps5.action=proxy
                forkop.ps5.console_mode=1
                forkop.ps5.fully_routed_ips=192.168.1.50
            """), encoding='utf-8')
            uci_env = {'FORKOP_UCI_STATE_FILE': str(uci_state)}

            for proto in ('udp', 'quic', 'stun'):
                exp = run_ucode(
                    [explain_uc, 'explain', json.dumps({'destination_ip': '203.0.113.99', 'device': '192.168.1.50', 'protocol': proto})],
                    extra_env=uci_env,
                    check=True,
                )
                body = json.loads(exp.stdout)
                self.assertTrue(body['success'], exp.stdout)
                self.assertEqual(body['data']['decision'], {
                    'status': 'direct',
                    'section': 'ps5',
                    'outbound': 'direct-out',
                })
                self.assertEqual(body['data']['trace'][-1]['reason'], 'console_udp_direct')

            exp_missing = run_ucode(
                [explain_uc, 'explain', json.dumps({'destination_ip': '203.0.113.99', 'device': '192.168.1.50'})],
                extra_env=uci_env,
                check=True,
            )
            body_missing = json.loads(exp_missing.stdout)
            self.assertEqual(body_missing['data']['decision']['status'], 'indeterminate')
            self.assertIn('protocol', body_missing['data']['missing'])
            self.assertEqual(body_missing['data']['trace'][-1]['reason'], 'console_protocol_required')

            exp_tcp = run_ucode(
                [explain_uc, 'explain', json.dumps({'destination_ip': '203.0.113.99', 'device': '192.168.1.50', 'protocol': 'tcp'})],
                extra_env=uci_env,
                check=True,
            )
            body_tcp = json.loads(exp_tcp.stdout)
            self.assertEqual(body_tcp['data']['decision']['status'], 'matched')
            self.assertEqual(body_tcp['data']['decision']['section'], 'ps5')

    def test_torrserver_cgroup_direct_bypass_and_unsafe_cgroup_rejection(self):
        torrserver_uc = FORKOP_LIB / 'service/torrserver.uc'
        self.assertTrue(torrserver_uc.exists(), 'service/torrserver.uc must exist')
        nft_uc = FORKOP_LIB / 'nft/apply.uc'
        state_uc = FORKOP_LIB / 'service/state.uc'

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            cgroup_root = tmp_path / 'cgroup'
            (cgroup_root / 'services/torrserver').mkdir(parents=True)
            (cgroup_root / 'services').mkdir(exist_ok=True)
            (cgroup_root / 'system.slice').mkdir(exist_ok=True)
            nft_log = tmp_path / 'nft.log'

            write_executable(
                bin_dir / 'nft',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "${{MOCK_NFT_FAIL:-0}}" = "1" ] && [ "$1" = "-f" ]; then
                        printf 'nft-fail %s\\n' "$*" >> "{nft_log}"
                        exit 1
                    fi
                    if [ "$1" = "-f" ]; then
                        cat "$2" >> "{nft_log}"
                        exit 0
                    fi
                    printf 'nft %s\\n' "$*" >> "{nft_log}"
                    exit 0
                """),
            )
            env_base = {
                'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}",
                'FORKOP_CGROUP_ROOT': str(cgroup_root),
            }

            apply_proc = run_ucode(
                [
                    '-e',
                    textwrap.dedent("""
                        let ts = require("service.torrserver");
                        let ok = ts.apply({ torrserver_direct: "1" }, "198.18.0.0/15", "2001:2::/112", "0x08000000");
                        printf("%J\\n", { ok });
                    """).strip(),
                ],
                extra_env=env_base,
            )
            self.assertEqual(apply_proc.returncode, 0, apply_proc.stderr)
            rendered = nft_log.read_text(encoding='utf-8')
            self.assertIn('ForkopTorrServerDirect', rendered)
            self.assertIn('type route hook output priority -151; policy accept;', rendered)
            self.assertIn('ip daddr 198.18.0.0/15 return', rendered)
            self.assertIn('ip6 daddr 2001:2::/112 return', rendered)
            self.assertIn('socket cgroupv2 level 2 "services/torrserver" meta mark set 0x08000000 counter', rendered)

            # Unsafe cgroups must be rejected without crashing startup
            for unsafe in ('/', '/services', '/system.slice', '/services/../etc', '/services/bad space', '/services/"quote"'):
                nft_log.write_text('', encoding='utf-8')
                unsafe_proc = run_ucode(
                    [
                        '-e',
                        textwrap.dedent(f"""
                            let ts = require("service.torrserver");
                            let res = ts.apply({{ torrserver_direct: "1", torrserver_cgroup: {json.dumps(unsafe)} }}, "198.18.0.0/15", "2001:2::/112", "0x08000000");
                            printf("%J\\n", {{ res }});
                        """).strip(),
                    ],
                    extra_env=env_base,
                )
                self.assertEqual(unsafe_proc.returncode, 0, unsafe_proc.stderr)
                self.assertNotIn('socket cgroupv2', nft_log.read_text(encoding='utf-8'))

            # nft socket support failure must not fail service startup
            fail_proc = run_ucode(
                [
                    '-e',
                    'let ts = require("service.torrserver"); ts.apply({ torrserver_direct: "1" }, "198.18.0.0/15", "2001:2::/112", "0x08000000");',
                ],
                extra_env={**env_base, 'MOCK_NFT_FAIL': '1'},
            )
            self.assertEqual(fail_proc.returncode, 0, fail_proc.stderr)

            # Signature parity and sensitivity for torrserver_direct + torrserver_cgroup
            f_off = tmp_path / 'ts-off.json'
            f_on1 = tmp_path / 'ts-on1.json'
            f_on2 = tmp_path / 'ts-on2.json'
            f_off.write_text(json.dumps({'settings': {'torrserver_direct': '0'}, 'section': [], 'sections': []}), encoding='utf-8')
            f_on1.write_text(json.dumps({'settings': {'torrserver_direct': '1', 'torrserver_cgroup': '/services/torrserver'}, 'section': [], 'sections': []}), encoding='utf-8')
            f_on2.write_text(json.dumps({'settings': {'torrserver_direct': '1', 'torrserver_cgroup': '/services/torrserver2'}, 'section': [], 'sections': []}), encoding='utf-8')

            s_off = run_ucode([state_uc, 'nft-signature-fixture', f_off], check=True).stdout.strip()
            s_on1 = run_ucode([state_uc, 'nft-signature-fixture', f_on1], check=True).stdout.strip()
            s_on2 = run_ucode([state_uc, 'nft-signature-fixture', f_on2], check=True).stdout.strip()
            a_on1 = run_ucode([nft_uc, 'nft-runtime-signature-fixture', f_on1], check=True).stdout.strip()
            self.assertEqual(s_on1, a_on1)
            self.assertNotEqual(s_off, s_on1)
            self.assertNotEqual(s_on1, s_on2)

    def test_lifecycle_fakeip6_stamp_migration_and_stop_cleanup(self):
        lifecycle_uc = FORKOP_LIB / 'service/lifecycle.uc'
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            state_dir = tmp_path / 'run/forkop'
            state_dir.mkdir(parents=True)
            cache_db = tmp_path / 'cache.db'
            stamp_file = state_dir / 'fakeip6.range'
            cmd_log = tmp_path / 'cmd.log'
            uci_state = tmp_path / 'uci.state'
            uci_state.write_text(
                f"forkop.settings=settings\nforkop.settings.cache_path={cache_db}\nforkop.settings.dont_touch_dhcp=1\ndhcp.@dnsmasq[0]=dnsmasq\n",
                encoding='utf-8',
            )

            for tool in ('ip', 'nft', 'ubus', 'crontab', 'pgrep', 'killall', 'sing-box-init'):
                write_executable(
                    bin_dir / tool,
                    textwrap.dedent(f"""\
                        #!/bin/sh
                        if [ "{tool}" = "ip" ] && [ "$1" = "-4" ] && [ "$2" = "rule" ] && [ "$3" = "list" ]; then
                            printf '104:\\tfrom all fwmark 0x04000000/0x04000000 iif lo lookup main\\n'
                            exit 0
                        fi
                        printf '{tool} %s\\n' "$*" >> "{cmd_log}"
                        exit 0
                    """),
                )

            env_base = {
                'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}",
                'FORKOP_UCI_STATE_FILE': str(uci_state),
                'FORKOP_SING_BOX_INIT': str(bin_dir / 'sing-box-init'),
                'FORKOP_RUNTIME_STATE_DIR': str(state_dir),
                'FORKOP_FAKEIP6_RANGE_STAMP_FILE': str(stamp_file),
            }

            # 1) Fresh boot with no stamp: must preserve existing test fixture cache.db and write stamp
            cache_db.write_text('fixture-cache', encoding='utf-8')
            res1 = run_ucode([lifecycle_uc, 'sync-fakeip6-range-stamp'], extra_env=env_base)
            self.assertEqual(res1.returncode, 0, res1.stderr)
            self.assertTrue(cache_db.exists(), 'Fresh boot without prior stamp must NOT delete cache.db')
            self.assertEqual(stamp_file.read_text(encoding='utf-8').strip(), '2001:2::/112')

            # 2) Stamp matches current range: must preserve cache.db
            res2 = run_ucode([lifecycle_uc, 'sync-fakeip6-range-stamp'], extra_env=env_base)
            self.assertEqual(res2.returncode, 0, res2.stderr)
            self.assertTrue(cache_db.exists())

            # 3) Legacy stamp fc00::/18: must unlink stale cache.db and update stamp to 2001:2::/112
            stamp_file.write_text('fc00::/18\n', encoding='utf-8')
            res3 = run_ucode([lifecycle_uc, 'sync-fakeip6-range-stamp'], extra_env=env_base)
            self.assertEqual(res3.returncode, 0, res3.stderr)
            self.assertFalse(cache_db.exists(), 'Stale fc00::/18 cache.db must be unlinked when stamp changes')
            self.assertEqual(stamp_file.read_text(encoding='utf-8').strip(), '2001:2::/112')

            # 4) stop removes priority 104 rule and ForkopTorrServerDirect
            stop_res = run_ucode([lifecycle_uc, 'stop'], extra_env=env_base)
            self.assertEqual(stop_res.returncode, 0, stop_res.stderr)
            logged = cmd_log.read_text(encoding='utf-8')
            self.assertIn(
                'ip -4 rule del iif lo fwmark 0x04000000/0x04000000 lookup main priority 104',
                logged,
            )
            self.assertIn('ForkopTorrServerDirect', logged)

    def test_bittorrent_direct_singbox_route_route_explain_and_signature(self):
        state_uc = FORKOP_LIB / 'service/state.uc'
        explain_uc = FORKOP_LIB / 'service/route_explain.uc'

        route_proc = run_ucode([
            '-e',
            textwrap.dedent("""
                let route = require("singbox.route");
                let on = route.config({ bittorrent_direct: "1" }, { source_aware_dns: true });
                let off = route.config({ bittorrent_direct: "0" }, { source_aware_dns: true });
                printf("%J\\n", { on: on.rules, off: off.rules });
            """).strip(),
        ])
        self.assertEqual(route_proc.returncode, 0, route_proc.stderr)
        built = json.loads(route_proc.stdout)

        bt_rules_on = [r for r in built['on'] if r.get('protocol') == 'bittorrent']
        self.assertEqual(len(bt_rules_on), 1)
        self.assertEqual(bt_rules_on[0], {
            'action': 'route',
            'inbound': ['tproxy-in', 'tproxy6-in'],
            'protocol': 'bittorrent',
            'outbound': 'direct-out',
        })
        self.assertNotIn('bittorrent-extended', route_proc.stdout)
        bt_rules_off = [r for r in built['off'] if 'protocol' in r and 'bittorrent' in str(r.get('protocol'))]
        self.assertEqual(bt_rules_off, [])

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            uci_state = tmp_path / 'uci.state'
            uci_state.write_text(textwrap.dedent("""\
                forkop.settings=settings
                forkop.settings.dns_server=1.1.1.1
                forkop.settings.bittorrent_direct=1
                forkop.main=section
                forkop.main.enabled=1
                forkop.main.action=proxy
                forkop.main.fully_routed_ips=192.168.1.10
            """), encoding='utf-8')
            exp = run_ucode(
                [explain_uc, 'explain', json.dumps({'destination_ip': '203.0.113.99', 'device': '192.168.1.10', 'protocol': 'bittorrent'})],
                extra_env={'FORKOP_UCI_STATE_FILE': str(uci_state)},
                check=True,
            )
            payload = json.loads(exp.stdout)
            self.assertTrue(payload['success'], exp.stdout)
            self.assertEqual(payload['data']['decision'], {
                'status': 'direct',
                'section': None,
                'outbound': 'direct-out',
            })
            self.assertEqual(payload['data']['trace'][-1], {
                'section': None,
                'match': 'yes',
                'reason': 'bittorrent_direct',
            })

            f_on = tmp_path / 'bt-on.json'
            f_off = tmp_path / 'bt-off.json'
            f_on.write_text(json.dumps({'settings': {'bittorrent_direct': '1'}}), encoding='utf-8')
            f_off.write_text(json.dumps({'settings': {'bittorrent_direct': '0'}}), encoding='utf-8')
            s_on = run_ucode([state_uc, 'sing-box-signature-fixture', f_on], check=True).stdout.strip()
            s_off = run_ucode([state_uc, 'sing-box-signature-fixture', f_off], check=True).stdout.strip()
            self.assertNotEqual(s_on, s_off)

    def test_dns_failover_three_strike_debounce_startup_grace_and_pid_ticks(self):
        failover_uc = FORKOP_LIB / 'singbox/dns_failover.uc'
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            run_dir = tmp_path / 'run/forkop'
            run_dir.mkdir(parents=True)
            proc_root = tmp_path / 'proc'
            (proc_root / '4242').mkdir(parents=True)
            (proc_root / '4242/stat').write_text('4242 (sing-box) S 1 4242 4242 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 10000 0 0\n', encoding='utf-8')

            state_file = run_dir / 'dns-failover.json'
            pid_file = run_dir / 'dns-failover.pid'
            loop_state_file = tmp_path / 'loop-state.json'
            apply_log = tmp_path / 'apply.log'
            dig_log = tmp_path / 'dig.log'
            uci_state = tmp_path / 'uci.state'
            uci_state.write_text(textwrap.dedent("""\
                forkop.settings=settings
                forkop.settings.dns_type=udp
                forkop.settings.dns_server=1.1.1.1 8.8.8.8
                forkop.settings.bootstrap_dns_server=77.88.8.8
                forkop.settings.dns_check_interval=10s
                forkop.settings.dns_recovery_check_interval=60s
                forkop.settings.dns_check_timeout=1s
            """), encoding='utf-8')

            state_file.write_text(json.dumps({
                'version': 1,
                'dns_type': 'udp',
                'dns_detour': '',
                'main_servers': ['1.1.1.1', '8.8.8.8'],
                'bootstrap_servers': ['77.88.8.8'],
                'main_index': 0,
                'bootstrap_index': 0,
            }), encoding='utf-8')

            write_executable(
                bin_dir / 'ubus',
                textwrap.dedent("""\
                    #!/bin/sh
                    printf '{"sing-box":{"instances":{"main":{"running":%s,"pid":%s}}}}\\n' "${MOCK_SB_RUNNING:-true}" "${MOCK_SB_PID:-4242}"
                """),
            )
            write_executable(
                bin_dir / 'dig',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    printf 'dig %s\\n' "$*" >> "{dig_log}"
                    port=""
                    prev=""
                    for arg in "$@"; do
                        if [ "$prev" = "-p" ]; then
                            port="$arg"
                            prev=""
                            continue
                        fi
                        if [ "$arg" = "-p" ]; then
                            prev="-p"
                        fi
                    done
                    case "$port" in
                        10053)
                            [ "${{MOCK_PORT_10053_ALIVE:-0}}" = "1" ] && printf '93.184.216.34\\n' && exit 0
                            exit 1
                            ;;
                        10055)
                            [ "${{MOCK_PORT_10055_ALIVE:-1}}" = "1" ] && printf '93.184.216.34\\n' && exit 0
                            exit 1
                            ;;
                    esac
                    exit 1
                """),
            )
            mock_forkop_bin = bin_dir / 'forkop'
            write_executable(
                mock_forkop_bin,
                textwrap.dedent(f"""\
                    #!/bin/sh
                    if [ "$1" = "dns_failover_apply" ]; then
                        printf 'apply %s\\n' "$2" >> "{apply_log}"
                        cp "$2" "{state_file}"
                        exit 0
                    fi
                    exit 1
                """),
            )

            env_base = {
                'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}",
                'FORKOP_UCI_STATE_FILE': str(uci_state),
                'FORKOP_BIN': str(mock_forkop_bin),
                'FORKOP_RUNTIME_STATE_DIR': str(run_dir),
                'FORKOP_DNS_FAILOVER_STATE_FILE': str(state_file),
                'FORKOP_DNS_FAILOVER_PID_FILE': str(pid_file),
                'FORKOP_PROC_ROOT': str(proc_root),
                'FORKOP_DNS_FAILOVER_STRIKES': '3',
                'FORKOP_DNS_FAILOVER_GRACE_SECONDS': '90',
            }

            # 1) Within 90s startup grace window (mono_now=100 then mono_now=150): NO probes and NO switch
            r_grace1 = run_ucode([failover_uc, 'step-fixture', loop_state_file, '100'], extra_env=env_base)
            self.assertEqual(r_grace1.returncode, 0, r_grace1.stderr)
            r_grace2 = run_ucode([failover_uc, 'step-fixture', loop_state_file, '150'], extra_env=env_base)
            self.assertEqual(r_grace2.returncode, 0, r_grace2.stderr)
            self.assertFalse(dig_log.exists(), 'Must not probe DNS while within sing-box startup grace window')

            # 2) Past grace window (mono_now >= 190): 3-strike debounce!
            # Strike 1 (mono=191) -> stays on 0
            run_ucode([failover_uc, 'step-fixture', loop_state_file, '191'], extra_env=env_base, check=True)
            self.assertEqual(json.loads(state_file.read_text())['main_index'], 0)
            # Strike 2 (mono=202) -> stays on 0
            run_ucode([failover_uc, 'step-fixture', loop_state_file, '202'], extra_env=env_base, check=True)
            self.assertEqual(json.loads(state_file.read_text())['main_index'], 0)
            # Success on active resets strike counter!
            run_ucode(
                [failover_uc, 'step-fixture', loop_state_file, '213'],
                extra_env={**env_base, 'MOCK_PORT_10053_ALIVE': '1'},
                check=True,
            )
            # Next 2 failures (strikes 1 & 2 again) still must NOT switch!
            run_ucode([failover_uc, 'step-fixture', loop_state_file, '224'], extra_env=env_base, check=True)
            run_ucode([failover_uc, 'step-fixture', loop_state_file, '235'], extra_env=env_base, check=True)
            self.assertEqual(json.loads(state_file.read_text())['main_index'], 0)
            self.assertFalse(apply_log.exists())
            # 3rd consecutive failure -> switches to index 1!
            run_ucode([failover_uc, 'step-fixture', loop_state_file, '246'], extra_env=env_base, check=True)
            self.assertEqual(json.loads(state_file.read_text())['main_index'], 1)
            self.assertTrue(apply_log.exists())

            # Recovery to primary (index 0) works on recovery interval without waiting 3 strikes
            run_ucode(
                [failover_uc, 'step-fixture', loop_state_file, '310'],
                extra_env={**env_base, 'MOCK_PORT_10053_ALIVE': '1'},
                check=True,
            )
            self.assertEqual(json.loads(state_file.read_text())['main_index'], 0)

            # 3) PID start_ticks verification on stop-runtime prevents killing recycled PID
            victim = subprocess.Popen(['sleep', '30'])
            try:
                (proc_root / str(victim.pid)).mkdir(parents=True)
                (proc_root / str(victim.pid) / 'stat').write_text(
                    f'{victim.pid} (unrelated) S 1 {victim.pid} {victim.pid} 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 999999 0 0\n',
                    encoding='utf-8',
                )
                pid_file.write_text(f'{victim.pid}\n12345\n', encoding='utf-8')
                stop_res = run_ucode([failover_uc, 'stop-runtime'], extra_env=env_base)
                self.assertEqual(stop_res.returncode, 0, stop_res.stderr)
                self.assertIsNone(victim.poll(), 'stop-runtime must NOT kill recycled PID with mismatched start_ticks')
                self.assertFalse(pid_file.exists())
            finally:
                victim.terminate()
                victim.wait(timeout=5)

    def test_priority_pin_guard_and_pid_ticks(self):
        priority_uc = FORKOP_LIB / 'singbox/priority.uc'
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            run_dir = tmp_path / 'run/forkop'
            cache_dir = run_dir / 'section-cache'
            cache_dir.mkdir(parents=True)
            etc_forkop = tmp_path / 'etc/forkop'
            etc_forkop.mkdir(parents=True)
            proc_root = tmp_path / 'proc'
            proc_root.mkdir(parents=True)

            selections_path = etc_forkop / 'selections.json'
            initial_selections = {
                'version': 1,
                'selections': {
                    'main-out': {'tag': 'nl-manual-1', 'origin': 'manual', 'updated_at': 1700000000},
                },
            }
            selections_path.write_text(json.dumps(initial_selections), encoding='utf-8')

            # Section cache has NO priorityGroups, only selectorTag + urltestTags (Pin Guard must still run!)
            (cache_dir / 'main.json').write_text(json.dumps({
                'section': 'main',
                'selectorTag': 'main-out',
                'urltestTags': ['main-auto-urltest'],
                'priorityGroups': {},
            }), encoding='utf-8')
            uci_state = tmp_path / 'uci.state'
            uci_state.write_text(textwrap.dedent("""\
                forkop.settings=settings
                forkop.settings.latency_test_url=https://cp.cloudflare.com/generate_204
                forkop.main=section
                forkop.main.enabled=1
                forkop.main.action=proxy
            """), encoding='utf-8')

            proxies_state = tmp_path / 'proxies.json'
            proxies_state.write_text(json.dumps({
                'proxies': {
                    'main-out': {
                        'type': 'Selector',
                        'now': 'nl-manual-1',
                        'all': ['main-auto-urltest', 'nl-manual-1', 'de-manual-2'],
                    },
                    'main-auto-urltest': {
                        'type': 'URLTest',
                        'now': 'de-manual-2',
                        'all': ['nl-manual-1', 'de-manual-2'],
                    },
                    'nl-manual-1': {'type': 'VLESS'},
                    'de-manual-2': {'type': 'VLESS'},
                },
            }), encoding='utf-8')
            curl_log = tmp_path / 'curl.log'

            write_executable(
                bin_dir / 'curl',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    printf 'curl %s\\n' "$*" >> "{curl_log}"
                    method="GET"
                    url=""
                    data=""
                    prev=""
                    for arg in "$@"; do
                        if [ "$prev" = "-X" ]; then method="$arg"; prev=""; continue; fi
                        if [ "$prev" = "--data-raw" ]; then data="$arg"; prev=""; continue; fi
                        if [ "$prev" = "--data-urlencode" ] || [ "$prev" = "--header" ] || [ "$prev" = "-w" ]; then prev=""; continue; fi
                        case "$arg" in
                            -X|--data-raw|--data-urlencode|--header|-w) prev="$arg" ;;
                            http://*|https://*|*/proxies*) url="$arg" ;;
                        esac
                    done
                    case "$method:$url" in
                        GET:*/proxies)
                            cat "{proxies_state}"
                            exit 0
                            ;;
                        GET:*/proxies/nl-manual-1/delay*)
                            if [ "${{MOCK_PIN_ALIVE:-0}}" = "1" ]; then
                                printf '{{"delay":42}}\\n'
                            else
                                printf '{{"message":"gateway timeout"}}\\n'
                            fi
                            exit 0
                            ;;
                        PUT:*/proxies/main-out)
                            python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); d=json.loads(sys.argv[2]); p["proxies"]["main-out"]["now"]=d["name"]; json.dump(p, open(sys.argv[1], "w"))' "{proxies_state}" "$data"
                            printf '\\n204'
                            exit 0
                            ;;
                    esac
                    exit 1
                """),
            )
            write_executable(
                bin_dir / 'ubus',
                '#!/bin/sh\nprintf \'{"sing-box":{"instances":{"main":{"running":true,"pid":1111}}}}\\n\'\n',
            )

            pin_guard_file = run_dir / 'pin-guard.json'
            pid_file = run_dir / 'priority.pid'
            env_base = {
                'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}",
                'FORKOP_UCI_STATE_FILE': str(uci_state),
                'FORKOP_RUNTIME_STATE_DIR': str(run_dir),
                'FORKOP_SECTION_CACHE_DIR': str(cache_dir),
                'FORKOP_SELECTIONS_FILE': str(selections_path),
                'FORKOP_PIN_GUARD_STATE_FILE': str(pin_guard_file),
                'FORKOP_PRIORITY_PID_FILE': str(pid_file),
                'FORKOP_PROC_ROOT': str(proc_root),
                'FORKOP_PIN_GUARD_STRIKES': '3',
            }

            # Strike 1 & 2: must NOT switch yet
            r1 = run_ucode([priority_uc, 'pin-guard-tick'], extra_env=env_base)
            self.assertEqual(r1.returncode, 0, r1.stderr)
            self.assertEqual(json.loads(proxies_state.read_text())['proxies']['main-out']['now'], 'nl-manual-1')

            r2 = run_ucode([priority_uc, 'pin-guard-tick'], extra_env=env_base)
            self.assertEqual(r2.returncode, 0, r2.stderr)
            self.assertEqual(json.loads(proxies_state.read_text())['proxies']['main-out']['now'], 'nl-manual-1')

            # Alive probe resets strikes!
            run_ucode([priority_uc, 'pin-guard-tick'], extra_env={**env_base, 'MOCK_PIN_ALIVE': '1'}, check=True)
            run_ucode([priority_uc, 'pin-guard-tick'], extra_env=env_base, check=True)
            run_ucode([priority_uc, 'pin-guard-tick'], extra_env=env_base, check=True)
            self.assertEqual(json.loads(proxies_state.read_text())['proxies']['main-out']['now'], 'nl-manual-1')

            # 3rd consecutive failure -> switches main-out to main-auto-urltest WITHOUT mutating selections.json!
            r3 = run_ucode([priority_uc, 'pin-guard-tick'], extra_env=env_base)
            self.assertEqual(r3.returncode, 0, r3.stderr)
            self.assertEqual(json.loads(proxies_state.read_text())['proxies']['main-out']['now'], 'main-auto-urltest')
            self.assertIn('timeout=5000', curl_log.read_text(encoding='utf-8'))
            self.assertEqual(
                json.loads(selections_path.read_text(encoding='utf-8')),
                initial_selections,
                'Pin Guard automatic fallback must NEVER overwrite /etc/forkop/selections.json',
            )
            self.assertTrue(pin_guard_file.exists(), 'Pin Guard must write /var/run/forkop/pin-guard.json')
            pg_data = json.loads(pin_guard_file.read_text(encoding='utf-8'))
            self.assertIn('main', json.dumps(pg_data))
            self.assertIn('main-auto-urltest', json.dumps(pg_data))

            # Verify stop-runtime checks start_ticks before killing PID
            victim = subprocess.Popen(['sleep', '30'])
            try:
                (proc_root / str(victim.pid)).mkdir(parents=True)
                (proc_root / str(victim.pid) / 'stat').write_text(
                    f'{victim.pid} (other) S 1 {victim.pid} {victim.pid} 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 888888 0 0\n',
                    encoding='utf-8',
                )
                pid_file.write_text(f'{victim.pid}\n22222\n', encoding='utf-8')
                stop_res = run_ucode([priority_uc, 'stop-runtime'], extra_env=env_base)
                self.assertEqual(stop_res.returncode, 0, stop_res.stderr)
                self.assertIsNone(victim.poll(), 'priority stop-runtime must NOT kill recycled PID')
                self.assertFalse(pid_file.exists())
            finally:
                victim.terminate()
                victim.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
