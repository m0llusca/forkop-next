"""Behavioral regression tests for backend security, correctness, and OpenWrt 25.12.6 compatibility."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'
BIN = ROOT / 'forkop/files/usr/bin/forkop'


def ucode_env(**extra):
    env = dict(os.environ)
    local_bin = str(Path.home() / '.local/bin')
    local_lib = str(Path.home() / '.local/lib')
    local_lib64 = str(Path.home() / '.local/lib64')
    env['PATH'] = f"{local_bin}:{env.get('PATH', '')}"
    env['LD_LIBRARY_PATH'] = f"{local_lib}:{local_lib64}:{env.get('LD_LIBRARY_PATH', '')}"
    env['FORKOP_LIB'] = str(LIB)
    env.update(extra)
    return env


def eval_ucode(code, *args, **extra_env):
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / 'eval_runner.uc'
        script.write_text(code)
        return subprocess.run(
            ['ucode', '-L', str(LIB), str(script), *args],
            env=ucode_env(**extra_env),
            text=True,
            capture_output=True,
            timeout=20,
        )


class AuditSecurityAndCompatTests(unittest.TestCase):
    def test_sec01_nfqueue_and_byedpi_reject_dangerous_execution_and_file_flags(self):
        code = """
        let nfq = require("providers.nfqueue.validator");
        let bye = require("providers.byedpi.validator");
        let out = {
            lua_init: nfq.validate_strategy("nfqws2", "--lua-init=@/tmp/x.lua --lua-desync=fake").valid,
            nfq_import: nfq.validate_strategy("nfqws2", "--import=/tmp/x --lua-desync=fake").valid,
            nfq_writeable: nfq.validate_strategy("nfqws2", "--writeable=/tmp --lua-desync=fake").valid,
            nfq_chdir: nfq.validate_strategy("nfqws2", "--chdir=/tmp --lua-desync=fake").valid,
            nfq_pidfile: nfq.validate_strategy("nfqws", "--pidfile=/etc/File --dpi-desync=fake").valid,
            nfq_user: nfq.validate_strategy("nfqws", "--user=root --dpi-desync=fake").valid,
            nfq_uid: nfq.validate_strategy("nfqws", "--uid=0:0 --dpi-desync=fake").valid,
            nfq_debug_file: nfq.validate_strategy("nfqws", "--debug=@/etc/File --dpi-desync=fake").valid,
            nfq_debug_level: nfq.validate_strategy("nfqws", "--debug=1 --dpi-desync=fake").valid,
            bye_cache_dump_long: bye.validate_strategy("--cache-dump /etc/File -s1").valid,
            bye_cache_dump_short: bye.validate_strategy("-L /etc/File -s1").valid,
            bye_safe: bye.validate_strategy("-s1 -o1").valid,
        };
        print(sprintf("%J", out));
        """
        run = eval_ucode(code)
        self.assertEqual(run.returncode, 0, run.stderr)
        res = json.loads(run.stdout)
        self.assertFalse(res['lua_init'], 'nfqws2 --lua-init must be rejected')
        self.assertFalse(res['nfq_import'], 'nfqws2 --import must be rejected')
        self.assertFalse(res['nfq_writeable'], 'nfqws2 --writeable must be rejected')
        self.assertFalse(res['nfq_chdir'], 'nfqws2 --chdir must be rejected')
        self.assertFalse(res['nfq_pidfile'], 'nfqws --pidfile must be rejected')
        self.assertFalse(res['nfq_user'], 'nfqws --user must be rejected')
        self.assertFalse(res['nfq_uid'], 'nfqws --uid must be rejected')
        self.assertFalse(res['nfq_debug_file'], 'nfqws --debug=@file must be rejected')
        self.assertTrue(res['nfq_debug_level'], 'numeric --debug=1 must remain valid')
        self.assertFalse(res['bye_cache_dump_long'], 'ciadpi --cache-dump must be rejected')
        self.assertFalse(res['bye_cache_dump_short'], 'ciadpi -L must be rejected')
        self.assertTrue(res['bye_safe'], 'ordinary ciadpi strategy must remain valid')

    def test_sec02_subscription_outbound_sanitization_and_detour_isolation(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            sub_dir = tmp_path / 'subs'
            sub_dir.mkdir()
            sub_url = 'https://sub.example/feed'
            (sub_dir / 'main-subscription-1.url').write_text(sub_url + '\n')
            sub_file = sub_dir / 'main-subscription-1.json'
            sub_payload = {
                'outbounds': [
                    {
                        'type': 'vless',
                        'tag': 'Good-Node',
                        'server': 'edge.example.com',
                        'server_port': 443,
                        'uuid': '11111111-1111-1111-1111-111111111111',
                        'detour': 'direct-out',
                        'bind_interface': 'br-lan',
                        'routing_mark': 1048576,
                        'inet4_bind_address': '192.168.1.1',
                        'tls': {
                            'enabled': True,
                            'server_name': 'edge.example.com',
                            'certificate_path': '/etc/shadow',
                            'key_path': '/etc/config/forkop',
                        },
                    },
                    {
                        'type': 'vless',
                        'tag': 'Loopback-SSRF',
                        'server': '127.0.0.1',
                        'server_port': 9090,
                        'uuid': '22222222-2222-2222-2222-222222222222',
                    },
                    {
                        'type': 'shadowsocks',
                        'tag': 'Bad-Plugin',
                        'server': 'ss.example.com',
                        'server_port': 8388,
                        'method': '2022-blake3-aes-128-gcm',
                        'password': 'abcdefghijklmnopqrstuv==',
                        'plugin': '/bin/sh',
                        'plugin_opts': '-c id',
                    },
                ],
            }
            sub_file.write_text(json.dumps(sub_payload))
            fixture = {
                'settings': {'.name': 'settings', '.type': 'settings'},
                'section': [
                    {
                        '.name': 'main',
                        '.type': 'section',
                        'enabled': '1',
                        'action': 'connection',
                        'domain_suffix': ['example.org'],
                    }
                ],
                'subscription_url': [
                    {
                        '.name': 'sub1',
                        '.type': 'subscription_url',
                        'section': 'main',
                        'url': sub_url,
                    }
                ],
            }
            fixture_path = tmp_path / 'fixture.json'
            output_path = tmp_path / 'config.json'
            fixture_path.write_text(json.dumps(fixture))
            run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'singbox/generator.uc'),
                    'generate-config-fixture',
                    str(fixture_path),
                    str(output_path),
                    '127.0.0.1',
                ],
                env=ucode_env(
                    FORKOP_SECTION_CACHE_DIR=str(tmp_path / 'cache'),
                    TMP_SUBSCRIPTION_FOLDER=str(sub_dir),
                    FORKOP_STRICT_SUBSCRIPTION_IPS='1',
                ),
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            generated = json.loads(output_path.read_text())
            by_tag = {item['tag']: item for item in generated['outbounds']}
            self.assertNotIn('Loopback-SSRF', by_tag, 'loopback subscription server must be rejected')
            self.assertNotIn('Bad-Plugin', by_tag, 'disallowed SIP003 plugin must be rejected')
            self.assertIn('Good-Node', by_tag)
            good = by_tag['Good-Node']
            self.assertNotIn('detour', good, 'cross-section internal detour hijack must be stripped')
            self.assertNotIn('bind_interface', good)
            self.assertNotIn('routing_mark', good)
            self.assertNotIn('inet4_bind_address', good)
            self.assertNotIn('certificate_path', good.get('tls', {}))
            self.assertNotIn('key_path', good.get('tls', {}))

    def test_sec03_asset_name_and_origin_validation_in_updater(self):
        code = """
        let updater = require("components.updater");
        print(sprintf("%J", {
            safe: updater.safe_asset_name ? updater.safe_asset_name("forkop_1.2.1-r2_all.apk") : false,
            traversal: updater.safe_asset_name ? updater.safe_asset_name("../etc/init.d/forkop") : true,
            slash: updater.safe_asset_name ? updater.safe_asset_name("sub/pkg.apk") : true,
            https_gh: updater.allowed_download_url ? updater.allowed_download_url("https://github.com/m0llusca/forkop-next/releases/download/v1.2.1-r2/forkop.apk") : false,
            http_gh: updater.allowed_download_url ? updater.allowed_download_url("http://github.com/m0llusca/forkop-next/releases/download/v1.2.1-r2/forkop.apk") : true,
            evil_host: updater.allowed_download_url ? updater.allowed_download_url("https://evil.example/forkop.apk") : true,
        }));
        """
        run = eval_ucode(code)
        self.assertEqual(run.returncode, 0, run.stderr)
        res = json.loads(run.stdout)
        self.assertTrue(res['safe'])
        self.assertFalse(res['traversal'])
        self.assertFalse(res['slash'])
        self.assertTrue(res['https_gh'])
        self.assertFalse(res['http_gh'])
        self.assertFalse(res['evil_host'])

    def test_sec04_config_permissions_0600_in_build_and_install_and_section_cache(self):
        build_sh = (ROOT / 'build.sh').read_text()
        install_sh = (ROOT / 'install.sh').read_text()
        self.assertNotIn(
            'install -m 0644 "$ROOT_DIR/forkop/files/etc/config/forkop"',
            build_sh,
            'build.sh must install /etc/config/forkop as 0600, not 0644',
        )
        self.assertNotIn(
            'chmod 0644 /etc/config/forkop',
            install_sh,
            'install.sh must restore /etc/config/forkop as 0600, not 0644',
        )
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            cache_dir = tmp_path / 'section-cache'
            fixture_path = tmp_path / 'fixture.json'
            output_path = tmp_path / 'config.json'
            fixture_path.write_text(
                json.dumps(
                    {
                        'settings': {'.name': 'settings', '.type': 'settings'},
                        'section': [
                            {
                                '.name': 'main',
                                '.type': 'section',
                                'enabled': '1',
                                'action': 'connection',
                                'selector_proxy_links': [
                                    'vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=example.com#Node'
                                ],
                                'domain_suffix': ['example.org'],
                            }
                        ],
                    }
                )
            )
            run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'singbox/generator.uc'),
                    'generate-config-fixture',
                    str(fixture_path),
                    str(output_path),
                    '127.0.0.1',
                ],
                env=ucode_env(FORKOP_SECTION_CACHE_DIR=str(cache_dir)),
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            section_file = cache_dir / 'main.json'
            self.assertTrue(section_file.exists())
            self.assertEqual(section_file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(cache_dir.stat().st_mode & 0o777, 0o700)

    def test_sec05_prerm_quotes_or_normalizes_action_and_migration_avoids_shell_wildcard(self):
        makefile = (ROOT / 'forkop/Makefile').read_text()
        build_sh = (ROOT / 'build.sh').read_text()
        migration_uc = (LIB / 'config/migration.uc').read_text()
        self.assertNotIn('package_prerm " + (ARGV[0] || "")', makefile)
        self.assertNotIn('package_prerm " + (ARGV[0] || "")', build_sh)
        self.assertNotIn('run("rm -f " + path)', migration_uc)

    def test_sec07_latency_path_traversal_and_latency_url_ssrf_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            action_dir = tmp_path / 'actions'
            (action_dir / 'latency-jobs').mkdir(parents=True)
            victim = action_dir / 'victim.json'
            victim.write_text(json.dumps({'kind': 'latency', 'running': True, 'untouched': True}))
            traversal = f"{action_dir}/latency-jobs/../victim.json"
            run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'service/ui.uc'),
                    'latency-progress-state',
                    traversal,
                    '1',
                    '2',
                    '0',
                ],
                env=ucode_env(FORKOP_UI_ACTION_DIR=str(action_dir)),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertNotEqual(run.returncode, 0, 'traversal path in latency-progress-state must fail')
            self.assertNotIn('progress', json.loads(victim.read_text()), 'victim.json outside latency-jobs must not be modified')

        run_ssrf = subprocess.run(
            [
                'ucode',
                '-L',
                str(LIB),
                str(LIB / 'diagnostics/runtime.uc'),
                'clash-api',
                'get_proxy_latency',
                'main-out',
                '1000',
                'http://127.0.0.1:9090/configs',
            ],
            env=ucode_env(),
            text=True,
            capture_output=True,
            timeout=10,
        )
        parsed = json.loads(run_ssrf.stdout or '{}')
        self.assertIn('invalid', str(parsed.get('error', '')).lower(), 'internal HTTP SSRF URL in get_proxy_latency must be rejected before curl')

    def test_sec08_diagnostics_masks_multiline_outbound_jsons_inbound_json_and_all_network_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            forkop_cfg = tmp_path / 'forkop'
            forkop_cfg.write_text(
                "config section 'main'\n"
                "\toption\tproxy_string\t'vless://secret-uuid@example.com:443'\n"
                "\tlist outbound_jsons '{\n"
                "  \"type\": \"vless\",\n"
                "  \"uuid\": \"super-secret-uuid\"\n"
                "}'\n"
                "config server 'srv'\n"
                "\toption inbound_json '{\n"
                "  \"password\": \"super-secret-inbound-pw\"\n"
                "}'\n"
            )
            run = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/status.uc'), 'forkop-config-masked', str(forkop_cfg)],
                env=ucode_env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertNotIn('secret-uuid', run.stdout)
            self.assertNotIn('super-secret-uuid', run.stdout)
            self.assertNotIn('super-secret-inbound-pw', run.stdout)

            net_cfg = tmp_path / 'network'
            net_cfg.write_text(
                "config interface 'wan'\n"
                "\toption proto 'dhcp'\n"
                "config interface 'wg0'\n"
                "\toption proto 'wireguard'\n"
                "\toption private_key 'WG_SUPER_SECRET_KEY'\n"
                "config wireguard_wg0\n"
                "\toption preshared_key 'WG_SUPER_SECRET_PSK'\n"
            )
            run_net = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/status.uc'), 'wan-config-masked', str(net_cfg)],
                env=ucode_env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(run_net.returncode, 0, run_net.stderr)
            self.assertNotIn('WG_SUPER_SECRET_KEY', run_net.stdout)
            self.assertNotIn('WG_SUPER_SECRET_PSK', run_net.stdout)

    def test_bug01_uci_get_custom_config_path_honored_in_impact_compatibility_and_probe(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            uci_dir = tmp_path / 'uci'
            uci_dir.mkdir()
            custom_sb = tmp_path / 'custom-sing-box.json'
            custom_sb.write_text(
                json.dumps(
                    {
                        'inbounds': [
                            {
                                'type': 'mixed',
                                'tag': 'main-mixed-in',
                                'listen': '127.0.0.1',
                                'listen_port': 28080,
                            }
                        ],
                        'outbounds': [
                            {
                                'type': 'vless',
                                'tag': 'main-out',
                                'tls': {
                                    'enabled': True,
                                    'reality': {'enabled': True},
                                    'record_fragment': True,
                                },
                            }
                        ],
                        'route': {
                            'rules': [
                                {
                                    'inbound': 'main-mixed-in',
                                    'action': 'route',
                                    'outbound': 'main-out',
                                }
                            ]
                        },
                    }
                )
            )
            (uci_dir / 'forkop').write_text(
                f"config settings 'settings'\n"
                f"\toption config_path '{custom_sb}'\n"
                f"config section 'main'\n"
                f"\toption enabled '1'\n"
                f"\toption action 'connection'\n"
                f"\toption mixed_proxy_enabled '1'\n"
                f"\toption mixed_proxy_port '28080'\n"
            )
            code = """
            let impact = require("components.impact");
            let preview = impact.preview(sprintf("%J", { component: "sing-box", action: "install" }));
            print(sprintf("%J", preview));
            """
            run = eval_ucode(code, FORKOP_UCI_CONFIG_DIR=str(uci_dir))
            self.assertEqual(run.returncode, 0, run.stderr)
            preview = json.loads(run.stdout)
            self.assertTrue(preview['success'])
            self.assertTrue(
                preview['data']['requirements']['record_fragment'],
                'components/impact.uc must read custom forkop.settings.config_path via 1-arg core.uci.get',
            )

    def test_bug02_apk_pre_upgrade_normalizes_system_exit_status(self):
        build_sh = (ROOT / 'build.sh').read_text()
        self.assertNotIn(
            'exit(system("/usr/bin/forkop package_prerm upgrade >/dev/null 2>&1"));',
            build_sh,
            'backend-pre-upgrade.sh must divide waitpid status >255 instead of truncating 256 to 0',
        )

    def test_bug03_service_action_worker_receives_reason_argv4(self):
        ui_uc = (LIB / 'service/ui.uc').read_text()
        self.assertIn(
            'service_action_worker(ARGV[1], ARGV[2], ARGV[3], ARGV[4])',
            ui_uc,
            'service-action-worker CLI dispatch must forward ARGV[4] reason',
        )

    def test_bug04_next_target_uses_reserved_outbound_tag_and_skips_disabled_target(self):
        code = """
        let route = require("singbox.route");
        let res = route.target({ action: "connection", next_target: "direct" }, "temp-out");
        print(sprintf("%J", res));
        """
        run = eval_ucode(code)
        self.assertEqual(run.returncode, 0, run.stderr)
        res = json.loads(run.stdout)
        self.assertEqual(
            res['outbound'],
            'direct-out-1',
            'next_target="direct" must map to reserved section tag direct-out-1, never unproxied direct-out',
        )

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fixture_path = tmp_path / 'fixture.json'
            output_path = tmp_path / 'config.json'
            fixture_path.write_text(
                json.dumps(
                    {
                        'settings': {'.name': 'settings', '.type': 'settings'},
                        'section': [
                            {
                                '.name': 'parent',
                                '.type': 'section',
                                'enabled': '0',
                                'action': 'connection',
                                'selector_proxy_links': [
                                    'vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=example.com#Node'
                                ],
                                'domain_suffix': ['parent.example'],
                            },
                            {
                                '.name': 'temp_rule',
                                '.type': 'section',
                                'enabled': '1',
                                'action': 'connection',
                                'next_target': 'parent',
                                'next_expires': '4102444800',
                                'domain_suffix': ['temp.example'],
                            },
                        ],
                    }
                )
            )
            gen = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'singbox/generator.uc'),
                    'generate-config-fixture',
                    str(fixture_path),
                    str(output_path),
                    '127.0.0.1',
                ],
                env=ucode_env(FORKOP_SECTION_CACHE_DIR=str(tmp_path / 'cache')),
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(gen.returncode, 0, gen.stderr)
            generated = json.loads(output_path.read_text())
            outbound_tags = {o['tag'] for o in generated['outbounds']}
            for rule in generated.get('route', {}).get('rules', []):
                if 'outbound' in rule:
                    self.assertIn(
                        rule['outbound'],
                        outbound_tags,
                        f"generated route references missing outbound {rule['outbound']}",
                    )

    def test_bug05_nft_mangle_exempts_router_owned_fib_local_addresses(self):
        nft_uc = (LIB / 'nft/apply.uc').read_text()
        self.assertRegex(
            nft_uc,
            r'nft_add_rule\(table,\s*"mangle",\s*\[\s*"iifname",\s*"@"\s*\+\s*as_string\(interface_set\),\s*"fib",\s*"daddr",\s*"type",\s*"local",\s*"return"\s*\]\)',
            'mangle chain must return on fib daddr type local before priority_rules/capture',
        )

    def test_bug06_route_explain_ipv6_canonical_and_cross_family_cidr_and_ipv6_controller(self):
        with tempfile.TemporaryDirectory() as tmp:
            uci_dir = Path(tmp)
            (uci_dir / 'forkop').write_text(
                "config settings 'settings'\n"
                "config section 'v6rule'\n"
                "\toption enabled '1'\n"
                "\toption action 'block'\n"
                "\tlist ip_cidr '2001:db8::/32'\n"
                "config section 'v6exact'\n"
                "\toption enabled '1'\n"
                "\toption action 'bypass'\n"
                "\tlist ip_cidr '2001:0db8:0000:0000:0000:0000:0000:0001'\n"
            )
            # IPv4 packet against IPv6 CIDR rule must NOT become indeterminate!
            run_v4 = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'service/route_explain.uc'),
                    'explain',
                    json.dumps({'destination_ip': '8.8.8.8', 'port': 443, 'protocol': 'tcp'}),
                ],
                env=ucode_env(FORKOP_UCI_CONFIG_DIR=str(uci_dir)),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(run_v4.returncode, 0, run_v4.stderr)
            data_v4 = json.loads(run_v4.stdout)['data']
            self.assertEqual(data_v4['decision']['status'], 'direct')

            # Compressed IPv6 address must match 2001:db8::/32 CIDR!
            run_v6_cidr = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'service/route_explain.uc'),
                    'explain',
                    json.dumps({'destination_ip': '2001:db8::cafe', 'port': 443, 'protocol': 'tcp'}),
                ],
                env=ucode_env(FORKOP_UCI_CONFIG_DIR=str(uci_dir)),
                text=True,
                capture_output=True,
                timeout=10,
            )
            data_v6_cidr = json.loads(run_v6_cidr.stdout)['data']
            self.assertEqual(data_v6_cidr['decision']['status'], 'blocked')

    def test_compat01_and_compat04_apk_zip_arch_selection_and_safe_singbox_core_limit(self):
        zip_listing = (
            "      123  2026-01-01 00:00   apk/luci-app-zapret-71.apk\n"
            "      456  2026-01-01 00:00   apk/x86_64/zapret-71-r1.apk\n"
            "      789  2026-01-01 00:00   apk/aarch64_cortex-a53/zapret-mdig-71-r1.apk\n"
            "     1024  2026-01-01 00:00   apk/aarch64_cortex-a53/zapret-71-r1.apk\n"
        )
        run = subprocess.run(
            [
                'ucode',
                '-L',
                str(LIB),
                str(LIB / 'components/updater.uc'),
                'zip-inner-package-path',
                'zapret',
                'aarch64_cortex-a53',
                'apk',
            ],
            input=zip_listing,
            env=ucode_env(),
            text=True,
            capture_output=True,
            timeout=10,
        )
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(
            run.stdout.strip(),
            'apk/aarch64_cortex-a53/zapret-71-r1.apk',
            'OpenWrt 25.12.6 aarch64_cortex-a53 apk selection must pick arch-matching main package, not subpackage or wrong arch',
        )

        code = """
        let script = require("singbox.service_script").text("managed");
        print(script);
        """
        svc = eval_ucode(code)
        self.assertNotIn('core="unlimited"', svc.stdout, 'managed sing-box init script must not enable unlimited core dumps on 512 MiB routers')
        self.assertIn('mkdir -p "$working_directory"', svc.stdout)

    def test_calib01_nfqws2_lua_init_allows_provider_lua_dir_and_blocks_traversal_and_inline(self):
        code = """
        let nfq = require("providers.nfqueue.validator");
        let out = {
            attached_lua: nfq.validate_strategy("nfqws2", "--lua-init=@/opt/zapret2/lua/custom-youtube.lua --lua-desync=fake").valid,
            separate_gz: nfq.validate_strategy("nfqws2", "--lua-init @/opt/zapret2/lua/helper_v2.lua.gz --lua-desync=fake").valid,
            outside_tmp: nfq.validate_strategy("nfqws2", "--lua-init=@/tmp/evil.lua --lua-desync=fake").valid,
            traversal: nfq.validate_strategy("nfqws2", "--lua-init=@/opt/zapret2/lua/../evil.lua --lua-desync=fake").valid,
            subdir: nfq.validate_strategy("nfqws2", "--lua-init=@/opt/zapret2/lua/sub/evil.lua --lua-desync=fake").valid,
            inline_code: nfq.validate_strategy("nfqws2", "--lua-init=os.execute('id') --lua-desync=fake").valid,
            separate_inline: nfq.validate_strategy("nfqws2", "--lua-init os.execute('id') --lua-desync=fake").valid,
            wrong_ext: nfq.validate_strategy("nfqws2", "--lua-init=@/opt/zapret2/lua/payload.sh --lua-desync=fake").valid,
            nfqws_v1: nfq.validate_strategy("nfqws", "--lua-init=@/opt/zapret2/lua/custom.lua --dpi-desync=fake").valid,
        };
        print(sprintf("%J", out));
        """
        run = eval_ucode(code)
        self.assertEqual(run.returncode, 0, run.stderr)
        res = json.loads(run.stdout)
        self.assertTrue(res['attached_lua'], 'nfqws2 --lua-init=@/opt/zapret2/lua/*.lua must be allowed')
        self.assertTrue(res['separate_gz'], 'nfqws2 --lua-init @/opt/zapret2/lua/*.lua.gz must be allowed')
        self.assertFalse(res['outside_tmp'], 'nfqws2 --lua-init outside /opt/zapret2/lua must be rejected')
        self.assertFalse(res['traversal'], 'nfqws2 --lua-init path traversal must be rejected')
        self.assertFalse(res['subdir'], 'nfqws2 --lua-init nested subdir must be rejected')
        self.assertFalse(res['inline_code'], 'nfqws2 inline Lua execution must be rejected')
        self.assertFalse(res['separate_inline'], 'nfqws2 separate-token inline Lua execution must be rejected')
        self.assertFalse(res['wrong_ext'], 'nfqws2 non-lua extension must be rejected')
        self.assertFalse(res['nfqws_v1'], 'nfqws v1 must not accept --lua-init')

    def test_calib02_shadowsocks_sip002_and_clash_plugin_normalization(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            uri_in = tmp_path / 'ss.uri'
            uri_out = tmp_path / 'ss.json'
            uri_in.write_text(
                'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ@198.51.100.20:8388/?plugin=simple-obfs%3Bobfs%3Dhttp%3Bobfs-host%3Dcdn.example.com#SS-SimpleObfs\n'
            )
            r_uri = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'subscription/parser.uc'), 'normalize-uri-list', str(uri_in), str(uri_out)],
                env=ucode_env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(r_uri.returncode, 0, r_uri.stderr)
            ss_uri_ob = json.loads(uri_out.read_text())['outbounds'][0]
            self.assertEqual(ss_uri_ob.get('plugin'), 'obfs-local')
            self.assertEqual(ss_uri_ob.get('plugin_opts'), 'obfs=http;obfs-host=cdn.example.com')

            clash_in = tmp_path / 'clash.yaml'
            clash_out = tmp_path / 'clash.json'
            clash_in.write_text(
                'proxies:\n'
                '  - name: Clash-SS-Obfs\n'
                '    type: ss\n'
                '    server: 198.51.100.21\n'
                '    port: 8388\n'
                '    cipher: aes-128-gcm\n'
                '    password: secret\n'
                '    plugin: obfs\n'
                '    plugin-opts:\n'
                '      mode: tls\n'
                '      host: tls.example.com\n'
                '  - name: Clash-HY2-Hop\n'
                '    type: hysteria2\n'
                '    server: 198.51.100.22\n'
                '    ports: 20000-40000,50000\n'
                '    password: hy2pw\n'
                '    sni: hy2.example.com\n'
            )
            r_clash = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'subscription/parser.uc'), 'normalize-clash-yaml', str(clash_in), str(clash_out)],
                env=ucode_env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(r_clash.returncode, 0, r_clash.stderr)
            clash_obs = {item['tag']: item for item in json.loads(clash_out.read_text())['outbounds']}
            self.assertEqual(clash_obs['Clash-SS-Obfs'].get('plugin'), 'obfs-local')
            self.assertEqual(clash_obs['Clash-SS-Obfs'].get('plugin_opts'), 'obfs=tls;obfs-host=tls.example.com')
            self.assertEqual(clash_obs['Clash-HY2-Hop'].get('server_ports'), ['20000:40000', '50000:50000'])
            self.assertNotIn('server_port', clash_obs['Clash-HY2-Hop'])

            fixture_path = tmp_path / 'manual-ss-fixture.json'
            output_path = tmp_path / 'manual-ss-config.json'
            fixture_path.write_text(
                json.dumps(
                    {
                        'settings': {'.name': 'settings', '.type': 'settings'},
                        'section': [
                            {
                                '.name': 'main',
                                '.type': 'section',
                                'enabled': '1',
                                'action': 'connection',
                                'selector_proxy_links': [
                                    'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ@198.51.100.25:8388/?plugin=simple-obfs%3Bobfs%3Dtls%3Bobfs-host%3Dmanual.example.com#ManualSS'
                                ],
                                'domain_suffix': ['example.org'],
                            }
                        ],
                    }
                )
            )
            r_gen = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'singbox/generator.uc'), 'generate-config-fixture', str(fixture_path), str(output_path), '127.0.0.1'],
                env=ucode_env(FORKOP_SECTION_CACHE_DIR=str(tmp_path / 'cache')),
                text=True,
                capture_output=True,
                timeout=15,
            )
            self.assertEqual(r_gen.returncode, 0, r_gen.stderr)
            by_tag = {item['tag']: item for item in json.loads(output_path.read_text())['outbounds']}
            manual_ss = by_tag['main-1-out']
            self.assertEqual(manual_ss.get('plugin'), 'obfs-local')
            self.assertEqual(manual_ss.get('plugin_opts'), 'obfs=tls;obfs-host=manual.example.com')

    def test_parity01_manual_hysteria2_mport_and_manual_link_url_decode_safety(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fixture_path = tmp_path / 'manual-parity-fixture.json'
            output_path = tmp_path / 'manual-parity-config.json'
            fixture_path.write_text(
                json.dumps(
                    {
                        'settings': {'.name': 'settings', '.type': 'settings'},
                        'section': [
                            {
                                '.name': 'main',
                                '.type': 'section',
                                'enabled': '1',
                                'action': 'connection',
                                'selector_proxy_links': [
                                    'hy2://p%40ss%3Fword@198.51.100.30:443/?mport=20000-40000,50000&obfs=none&sni=hy2.example.com#HY2Hop',
                                    'vless://11111111-1111-4111-8111-111111111111@198.51.100.31:443/?security=tls&sni=vless.example.com&type=ws&path=%2Fws%3Ftoken%3Da%26b%3Dc#VLESS-PercentAmp',
                                ],
                                'domain_suffix': ['example.org'],
                            }
                        ],
                        'urltest': [
                            {
                                '.name': 'ut0',
                                '.type': 'urltest',
                                'section': 'main',
                                'tolerance': '0',
                            }
                        ],
                    }
                )
            )
            r_gen = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'singbox/generator.uc'), 'generate-config-fixture', str(fixture_path), str(output_path), '127.0.0.1'],
                env=ucode_env(FORKOP_SECTION_CACHE_DIR=str(tmp_path / 'cache')),
                text=True,
                capture_output=True,
                timeout=15,
            )
            self.assertEqual(r_gen.returncode, 0, r_gen.stderr)
            by_tag = {item['tag']: item for item in json.loads(output_path.read_text())['outbounds']}
            hy2 = by_tag['main-1-out']
            self.assertEqual(hy2.get('password'), 'p@ss?word')
            self.assertEqual(hy2.get('server_ports'), ['20000:40000', '50000:50000'])
            self.assertNotIn('server_port', hy2)
            self.assertNotIn('obfs', hy2)

            vless = by_tag['main-2-out']
            self.assertEqual(vless.get('transport', {}).get('path'), '/ws?token=a&b=c')

            ut = by_tag['main-urltest-ut0-out']
            self.assertEqual(ut.get('tolerance'), 1, 'explicit 0ms tolerance must clamp to 1ms so sing-box does not reset it to 50ms')

    def test_parity02_router_mangle_output_ntp_exclusion(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            nft_log = tmp_path / 'nft.log'
            nft_stub = bin_dir / 'nft'
            nft_stub.write_text('#!/usr/bin/env sh\nprintf "%s\\n" "$*" >> "$NFT_LOG"\n')
            nft_stub.chmod(0o755)
            env = ucode_env(NFT_LOG=str(nft_log))
            env['PATH'] = f"{bin_dir}:{env['PATH']}"
            run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'nft/apply.uc'),
                    'nft-create-runtime-base',
                    'ForkopTable',
                    'localv4',
                    'forkop_subnets',
                    'forkop_ports',
                    'forkop_ip_ports',
                    'forkop_interfaces',
                    'br-lan',
                    '0x00100000',
                    '0x00200000',
                    '198.18.0.0/15',
                    '1602',
                    '1',
                ],
                env=env,
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            logged = nft_log.read_text()
            self.assertIn('insert rule inet ForkopTable mangle udp dport 123 return', logged)
            self.assertIn('insert rule inet ForkopTable mangle_output udp dport 123 return', logged)


if __name__ == '__main__':
    unittest.main()

