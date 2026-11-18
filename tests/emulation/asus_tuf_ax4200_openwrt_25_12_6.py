#!/usr/bin/env python3
"""ASUS TUF-AX4200 (mediatek/filogic, aarch64_cortex-a53) + OpenWrt 25.12.6 user-space router emulation.

Exercises real ucode, real libuci, real Forkop modules, and real SHA256-verified sing-box
against an authentic ASUS TUF-AX4200 OpenWrt 25.12.6 configuration and system state.

Explicit boundary (per AGENTS.md):
- Validates user-space CLI/RPC, UCI state, sing-box config generation, real `sing-box check`
  and live `sing-box run` Clash API, nftables ruleset emission, DNS/recovery state, APK
  aarch64_cortex-a53 resolution, core admission, and secret masking.
- Does NOT claim physical MediaTek MT7986A hardware switching or Linux kernel kmod-nft-tproxy
  packet datapath execution inside the container sandbox.
"""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'
BIN = ROOT / 'forkop/files/usr/bin/forkop'
CORES_DIR = Path(
    os.environ.get(
        'FORKOP_TEST_CORES_DIR',
        '/tmp/forkop-cores'
        if Path('/tmp/forkop-cores').exists()
        else str(Path.home() / '.cache/forkop-dev/forkop-cores'),
    )
)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def find_sing_box_binary() -> Path:
    candidates = [
        *sorted(CORES_DIR.glob('sing-box-1.14.3-extended-*/sing-box')),
        *sorted(CORES_DIR.glob('sing-box-1.14.3-*/sing-box')),
        CORES_DIR / 'sing-box-extended/1.14.3-extended-2.7.3/sing-box',
        CORES_DIR / 'sing-box/1.14.3/sing-box',
    ]
    for path in candidates:
        if path.is_file() and os.access(path, os.X_OK):
            return path
    found = shutil.which('sing-box')
    if found:
        return Path(found)
    raise RuntimeError('Provisioned sing-box binary not found; run tools/provision-test-cores.py first.')


class AsusTufAx4200OpenWrtEmulation:
    """Isolated ASUS TUF-AX4200 OpenWrt 25.12.6 user-space environment."""

    BOARD_MODEL = 'ASUS TUF-AX4200'
    BOARD_NAME = 'asus,tuf-ax4200'
    OPENWRT_RELEASE = '25.12.6'
    OPENWRT_REVISION = 'r33311-981c978eff'
    OPENWRT_TARGET = 'mediatek/filogic'
    OPENWRT_ARCH = 'aarch64_cortex-a53'
    KERNEL_VERSION = '6.12.112'
    MEM_TOTAL_KB = 503848
    MEM_AVAILABLE_KB = 368412

    def __init__(self, base_dir: Path):
        self.base = base_dir
        self.etc = base_dir / 'etc'
        self.uci_dir = self.etc / 'config'
        self.uci_state = base_dir / 'var/state'
        self.var_run = base_dir / 'var/run/forkop'
        self.next_dir = self.etc / 'forkop/next'
        self.mock_bin = base_dir / 'mock_bin'
        self.nft_log = base_dir / 'nft.log'
        self.sing_box_cfg = base_dir / 'etc/sing-box/config.json'
        self.sub_dir = base_dir / 'subs'
        self.clash_port = free_port()
        self.mixed_port = free_port()
        self.vless_in_port = free_port()
        self.ss_in_port = free_port()
        self.sing_box_bin = find_sing_box_binary()

    def setup(self):
        for d in [
            self.uci_dir,
            self.uci_state,
            self.var_run,
            self.next_dir,
            self.mock_bin,
            self.sing_box_cfg.parent,
            self.sub_dir,
            self.base / 'sys/class/net/br-lan',
            self.base / 'sys/class/net/eth1',
            self.base / 'sys/class/net/lo',
        ]:
            d.mkdir(parents=True, exist_ok=True)

        (self.etc / 'openwrt_release').write_text(
            textwrap.dedent(
                f"""\
                DISTRIB_ID='OpenWrt'
                DISTRIB_RELEASE='{self.OPENWRT_RELEASE}'
                DISTRIB_REVISION='{self.OPENWRT_REVISION}'
                DISTRIB_TARGET='{self.OPENWRT_TARGET}'
                DISTRIB_ARCH='{self.OPENWRT_ARCH}'
                DISTRIB_DESCRIPTION='OpenWrt {self.OPENWRT_RELEASE} {self.OPENWRT_REVISION}'
                """
            )
        )

        # Subscription feed file with realistic nodes + malicious injection attempts to verify defensive filtering
        (self.sub_dir / 'main-subscription-1.url').write_text(
            'https://sub.example.org/tuf-ax4200-secret-token\n'
        )
        sub_file = self.sub_dir / 'main-subscription-1.json'
        sub_file.write_text(
            json.dumps(
                {
                    'outbounds': [
                        {
                            'type': 'vless',
                            'tag': 'NL-Amsterdam-REALITY',
                            'server': 'nl-edge.example.com',
                            'server_port': 443,
                            'uuid': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                            'flow': 'xtls-rprx-vision',
                            'detour': 'direct-out',  # attempted internal detour hijack
                            'bind_interface': 'eth1',  # attempted interface hijack
                            'tls': {
                                'enabled': True,
                                'server_name': 'www.microsoft.com',
                                'utls': {'enabled': True, 'fingerprint': 'chrome'},
                                'reality': {
                                    'enabled': True,
                                    'public_key': 'n2-7B7P1w5N8vK6mX9zQ3rT4yU8iO0pA2sD4fG6hJ1k',
                                    'short_id': '0123456789abcdef',
                                },
                                'certificate_path': '/etc/config/forkop',  # attempted local file read
                            },
                        },
                        {
                            'type': 'trojan',
                            'tag': 'DE-Frankfurt-TLS',
                            'server': 'de-edge.example.com',
                            'server_port': 443,
                            'password': 'trojan-fixture-secret',
                            'tls': {
                                'enabled': True,
                                'server_name': 'de-edge.example.com',
                            },
                        },
                        {
                            'type': 'vless',
                            'tag': 'Local-Router-SSRF',
                            'server': '127.0.0.1',
                            'server_port': 9090,
                            'uuid': 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                        },
                    ],
                }
            )
        )
        self.sub_file = sub_file

        # Authentic ASUS TUF-AX4200 MediaTek Filogic DSA network config
        (self.uci_dir / 'network').write_text(
            textwrap.dedent(
                """\
                config interface 'loopback'
                \toption device 'lo'
                \toption proto 'static'
                \toption ipaddr '127.0.0.1'
                \toption netmask '255.0.0.0'

                config globals 'globals'
                \toption ula_prefix 'fd42:4200:abcd::/48'
                \toption packet_steering '1'

                config device
                \toption name 'br-lan'
                \toption type 'bridge'
                \tlist ports 'lan1'
                \tlist ports 'lan2'
                \tlist ports 'lan3'
                \tlist ports 'lan4'

                config interface 'lan'
                \toption device 'br-lan'
                \toption proto 'static'
                \toption ipaddr '192.168.1.1'
                \toption netmask '255.255.255.0'
                \toption ip6assign '60'

                config interface 'wan'
                \toption device 'eth1'
                \toption proto 'dhcp'

                config interface 'wan6'
                \toption device 'eth1'
                \toption proto 'dhcpv6'

                config interface 'wg_isp'
                \toption proto 'wireguard'
                \toption private_key 'ROUTER_WG_PRIVATE_KEY_DO_NOT_LEAK'
                """
            )
        )

        (self.uci_dir / 'dhcp').write_text(
            textwrap.dedent(
                f"""\
                config dnsmasq ' main_dns '
                \toption domainneeded '1'
                \toption localise_queries '1'
                \toption local '/lan/'
                \toption domain 'lan'
                \toption expandhosts '1'
                \toption authoritative '1'
                \toption readethers '1'
                \toption leasefile '{self.base}/dhcp.leases'
                \toption localuse '1'
                \toption cachesize '1000'
                """
            )
        )

        forkop_cfg = self.uci_dir / 'forkop'
        forkop_cfg.write_text(
            textwrap.dedent(
                f"""\
                config settings 'settings'
                \toption dns_type 'doh'
                \toption dns_server '1.1.1.1'
                \toption bootstrap_dns_server '1.1.1.1'
                \toption config_path '{self.sing_box_cfg}'
                \toption cache_path '{self.base}/cache.db'
                \toption https_domain_routing '1'
                \toption disable_quic '1'
                \toption exclude_ntp '1'
                \toption enable_yacd '0'
                \toption yacd_secret_key 'tuf-ax4200-local-secret'

                config section 'main'
                \toption label 'Основное подключение'
                \toption enabled '1'
                \toption action 'connection'
                \tlist domain_suffix 'youtube.com'
                \tlist domain_suffix 'googlevideo.com'
                \tlist domain_suffix 'openai.com'
                \toption mixed_proxy_enabled '1'
                \toption mixed_proxy_port '{self.mixed_proxy_port_str()}'
                \tlist outbound_jsons '{{
                  "type": "shadowsocks",
                  "tag": "Custom-JSON-Node",
                  "server": "json.example.com",
                  "server_port": 8388,
                  "method": "2022-blake3-aes-128-gcm",
                  "password": "TWljcm9TZWNyZXRLZXkxMg=="
                }}'

                config subscription_url 'sub_main'
                \toption section 'main'
                \toption url 'https://sub.example.org/tuf-ax4200-secret-token'

                config section 'ps5_gaming'
                \toption label 'Игровая консоль PS5'
                \toption enabled '1'
                \toption action 'connection'
                \toption next_target 'main'
                \toption next_expires '4102444800'
                \tlist fully_routed_ips '192.168.1.55/32'

                config section 'ru_direct'
                \toption label 'Прямой маршрут'
                \toption enabled '1'
                \toption action 'bypass'
                \tlist domain_suffix 'gosuslugi.ru'
                \tlist ip_cidr '2001:db8:9999::/48'

                config section 'ads_block'
                \toption label 'Блокировка трекеров'
                \toption enabled '1'
                \toption action 'block'
                \tlist domain_suffix 'ads-tracker.example'

                config server 'home_ss'
                \toption label 'Домашний Shadowsocks'
                \toption enabled '1'
                \toption protocol 'shadowsocks'
                \toption listen '127.0.0.1'
                \toption listen_port '{self.ss_in_port}'
                \toption shadowsocks_method '2022-blake3-aes-128-gcm'
                \toption server_password 'MTIzNDU2Nzg5MDEyMzQ1Ng=='
                """
            )
        )
        forkop_cfg.chmod(0o600)

        self._install_shims()

    def mixed_proxy_port_str(self) -> str:
        return str(self.mixed_port)

    def _install_shims(self):
        # Link real sing-box binary into mock_bin
        (self.mock_bin / 'sing-box').symlink_to(self.sing_box_bin)

        # OpenWrt 25.12.6 apk shim (aarch64_cortex-a53)
        apk = self.mock_bin / 'apk'
        apk.write_text(
            textwrap.dedent(
                f"""\
                #!/usr/bin/env bash
                case "$1" in
                  --print-arch)
                    echo "{self.OPENWRT_ARCH}"
                    exit 0
                    ;;
                  info)
                    shift
                    if [[ "$1" == "-e" ]]; then
                      pkg="$2"
                      case "$pkg" in
                        forkop|luci-app-forkop|sing-box-extended|nftables-json|nftables|dnsmasq-full|kmod-nft-tproxy|kmod-nft-fib|kmod-tun|ucode)
                          echo "$pkg"
                          exit 0
                          ;;
                        *) exit 1 ;;
                      esac
                    fi
                    echo "forkop-1.2.1-r2"
                    echo "luci-app-forkop-1.2.1-r2"
                    echo "sing-box-extended-1.14.3-extended-2.7.3"
                    echo "nftables-json-1.1.6-r2"
                    echo "dnsmasq-full-2.93-r2"
                    exit 0
                    ;;
                esac
                exit 0
                """
            )
        )
        apk.chmod(0o755)

        # OpenWrt ubus shim for ASUS TUF-AX4200
        ubus = self.mock_bin / 'ubus'
        board_json = json.dumps(
            {
                'kernel': self.KERNEL_VERSION,
                'hostname': 'TUF-AX4200',
                'system': 'ARMv8 Processor rev 4',
                'model': self.BOARD_MODEL,
                'board_name': self.BOARD_NAME,
                'rootfs_type': 'squashfs',
                'release': {
                    'distribution': 'OpenWrt',
                    'version': self.OPENWRT_RELEASE,
                    'revision': self.OPENWRT_REVISION,
                    'target': self.OPENWRT_TARGET,
                    'description': f'OpenWrt {self.OPENWRT_RELEASE} {self.OPENWRT_REVISION}',
                },
            }
        )
        sys_info_json = json.dumps(
            {
                'localtime': int(time.time()),
                'uptime': 86400,
                'memory': {
                    'total': self.MEM_TOTAL_KB * 1024,
                    'free': 280000 * 1024,
                    'shared': 4096 * 1024,
                    'buffered': 24000 * 1024,
                    'available': self.MEM_AVAILABLE_KB * 1024,
                },
            }
        )
        wan_status = json.dumps(
            {
                'up': True,
                'l3_device': 'eth1',
                'proto': 'dhcp',
                'ipv4-address': [{'address': '198.51.100.42', 'mask': 24}],
                'ipv6-address': [{'address': '2001:db8:4200::1', 'mask': 64}],
            }
        )
        ubus.write_text(
            textwrap.dedent(
                f"""\
                #!/usr/bin/env bash
                if [[ "$1" == "-S" ]]; then shift; fi
                if [[ "$1" == "call" ]]; then
                  case "$2:$3" in
                    system:board) printf '%s\\n' '{board_json}' ; exit 0 ;;
                    system:info) printf '%s\\n' '{sys_info_json}' ; exit 0 ;;
                    network.interface.wan:status) printf '%s\\n' '{wan_status}' ; exit 0 ;;
                    network.interface.wwan:status) printf '%s\\n' '{{"up":false}}' ; exit 0 ;;
                  esac
                fi
                printf '{{}}\\n'
                """
            )
        )
        ubus.chmod(0o755)

        # nft recording shim
        nft = self.mock_bin / 'nft'
        nft.write_text(
            textwrap.dedent(
                f"""\
                #!/usr/bin/env bash
                printf 'nft' >> "{self.nft_log}"
                for arg in "$@"; do printf '\\t%s' "$arg" >> "{self.nft_log}"; done
                printf '\\n' >> "{self.nft_log}"
                if [[ "$*" == *"list ruleset"* ]]; then
                  printf 'table inet ForkopTable {{}}\\n'
                fi
                exit 0
                """
            )
        )
        nft.chmod(0o755)

        # ip shim with dual-stack MediaTek eth1 WAN + br-lan
        ip_shim = self.mock_bin / 'ip'
        ip_shim.write_text(
            textwrap.dedent(
                """\
                #!/usr/bin/env bash
                case "$*" in
                  "-4 route show default")
                    echo "default via 198.51.100.1 dev eth1 proto static src 198.51.100.42"
                    ;;
                  "-6 route show default")
                    echo "default via fe80::1 dev eth1 proto ra metric 512"
                    ;;
                  "-4 addr show dev eth1")
                    echo "    inet 198.51.100.42/24 brd 198.51.100.255 scope global eth1"
                    ;;
                  "-6 addr show dev eth1")
                    echo "    inet6 2001:db8:4200::1/64 scope global dynamic noprefixroute"
                    ;;
                  *"addr show dev br-lan"*)
                    echo "    inet 192.168.1.1/24 brd 192.168.1.255 scope global br-lan"
                    echo "    inet6 2001:db8:4200:1::1/60 scope global noprefixroute"
                    ;;
                esac
                exit 0
                """
            )
        )
        ip_shim.chmod(0o755)

    def env(self, **extra) -> dict:
        env = dict(os.environ)
        local_bin = str(Path.home() / '.local/bin')
        local_lib = str(Path.home() / '.local/lib')
        local_lib64 = str(Path.home() / '.local/lib64')
        env['PATH'] = f"{self.mock_bin}:{local_bin}:{env.get('PATH', '')}"
        env['LD_LIBRARY_PATH'] = f"{local_lib}:{local_lib64}:{env.get('LD_LIBRARY_PATH', '')}"
        env['FORKOP_LIB'] = str(LIB)
        env['FORKOP_BIN'] = str(BIN)
        env['FORKOP_UCI_CONFIG_DIR'] = str(self.uci_dir)
        env['FORKOP_CONFIG_FILE'] = str(self.uci_dir / 'forkop')
        env['FORKOP_NEXT_DIR'] = str(self.next_dir)
        env['FORKOP_SECTION_CACHE_DIR'] = str(self.var_run / 'section-cache')
        env['FORKOP_RULESET_FOLDER'] = str(self.base / 'tmp/sing-box/rulesets')
        env['TMP_SUBSCRIPTION_FOLDER'] = str(self.sub_dir)
        env['FORKOP_SYS_CLASS_NET'] = str(self.base / 'sys/class/net')
        env['SB_CLASH_API_CONTROLLER_PORT'] = str(self.clash_port)
        env.update(extra)
        return env

    def generate_sing_box_config(self) -> dict:
        run = subprocess.run(
            [
                'ucode',
                '-L',
                str(LIB),
                str(LIB / 'singbox/generator.uc'),
                'generate-config',
                str(self.sing_box_cfg),
                '192.168.1.1',
                '0',
                '1',
            ],
            env=self.env(),
            text=True,
            capture_output=True,
            timeout=20,
        )
        if run.returncode != 0:
            raise RuntimeError(f"generator failed: {run.stdout}\n{run.stderr}")
        return json.loads(self.sing_box_cfg.read_text())


class AsusTufAx4200OpenWrt25126Test(unittest.TestCase):
    def test_full_router_emulation_lifecycle(self):
        with tempfile.TemporaryDirectory() as tmp:
            router = AsusTufAx4200OpenWrtEmulation(Path(tmp))
            router.setup()

            # 1. Generate sing-box config from ASUS TUF-AX4200 UCI + subscription + inbound server
            generated = router.generate_sing_box_config()
            by_tag = {o['tag']: o for o in generated['outbounds']}

            # Subscription security invariants on router
            self.assertIn('NL-Amsterdam-REALITY', by_tag)
            self.assertIn('DE-Frankfurt-TLS', by_tag)
            self.assertNotIn('Local-Router-SSRF', by_tag, '127.0.0.1 SSRF node must be stripped on router')
            nl_node = by_tag['NL-Amsterdam-REALITY']
            self.assertNotIn('detour', nl_node, 'subscription node must not hijack internal direct-out')
            self.assertNotIn('bind_interface', nl_node, 'subscription node must not hijack eth1/br-lan')
            self.assertNotIn('certificate_path', nl_node.get('tls', {}), 'subscription node must not read /etc/config/forkop')

            # 2. Validate generated router config with REAL sing-box check!
            check = subprocess.run(
                [str(router.sing_box_bin), 'check', '-c', str(router.sing_box_cfg), '-D', str(router.base)],
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(check.returncode, 0, f"real sing-box check failed: {check.stdout}\n{check.stderr}")

            # 3. Boot REAL live sing-box daemon (adapting router br-lan/TPROXY inbounds to unprivileged 127.0.0.1 for user-space boot)
            live_cfg = json.loads(router.sing_box_cfg.read_text())
            mixed_inbounds = [inb for inb in live_cfg.get('inbounds', []) if inb.get('tag') == 'main-mixed-in']
            self.assertEqual(len(mixed_inbounds), 1)
            self.assertEqual(mixed_inbounds[0].get('listen'), '192.168.1.1', 'mixed proxy must bind to br-lan 192.168.1.1 in generated router config')

            retained_inbounds = []
            retained_tags = set()
            for inb in live_cfg.get('inbounds', []):
                if inb.get('type') in ('mixed', 'shadowsocks') and inb.get('tag') != 'service-mixed-in':
                    inb_copy = dict(inb)
                    inb_copy['listen'] = '127.0.0.1'
                    retained_inbounds.append(inb_copy)
                    retained_tags.add(inb_copy['tag'])
            live_cfg['inbounds'] = retained_inbounds
            live_cfg['experimental']['clash_api']['external_controller'] = f"127.0.0.1:{router.clash_port}"
            if 'route' in live_cfg:
                live_cfg['route'].pop('auto_detect_interface', None)
                live_cfg['route'].pop('default_mark', None)
                filtered_rules = []
                for r in live_cfg['route'].get('rules', []):
                    if 'inbound' in r:
                        inb_field = r['inbound']
                        if isinstance(inb_field, list):
                            kept = [t for t in inb_field if t in retained_tags]
                            if not kept:
                                continue
                            r = {**r, 'inbound': kept}
                        elif inb_field not in retained_tags:
                            continue
                    filtered_rules.append(r)
                live_cfg['route']['rules'] = filtered_rules
            for outb in live_cfg.get('outbounds', []):
                outb.pop('routing_mark', None)
            live_cfg_path = router.base / 'live-sing-box.json'
            live_cfg_path.write_text(json.dumps(live_cfg))

            proc = subprocess.Popen(
                [str(router.sing_box_bin), 'run', '-c', str(live_cfg_path), '-D', str(router.base)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            try:
                # Poll live Clash API until ready
                proxies_payload = None
                for _ in range(40):
                    if proc.poll() is not None:
                        _, err = proc.communicate(timeout=5)
                        self.fail(f"sing-box exited early: {err}")
                    try:
                        req = urllib.request.Request(
                            f"http://127.0.0.1:{router.clash_port}/proxies",
                            headers={'Authorization': 'Bearer tuf-ax4200-local-secret'},
                        )
                        with urllib.request.urlopen(req, timeout=1) as resp:
                            if resp.status == 200:
                                proxies_payload = json.loads(resp.read().decode())
                                break
                    except Exception:
                        time.sleep(0.1)
                self.assertIsNotNone(proxies_payload, 'Live sing-box Clash API did not come online')
                self.assertIn('main-out', proxies_payload['proxies'])
                self.assertIn('NL-Amsterdam-REALITY', proxies_payload['proxies'])

                # Verify Forkop's own ucode Clash API client talks to live sing-box with Bearer auth!
                orig_cfg_text = router.sing_box_cfg.read_text()
                router.sing_box_cfg.write_text(live_cfg_path.read_text())
                try:
                    clash_uc = subprocess.run(
                        ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/runtime.uc'), 'clash-api', 'get_proxies'],
                        env=router.env(),
                        text=True,
                        capture_output=True,
                        timeout=10,
                    )
                finally:
                    router.sing_box_cfg.write_text(orig_cfg_text)
                self.assertEqual(clash_uc.returncode, 0, clash_uc.stderr)
                uc_proxies = json.loads(clash_uc.stdout)
                self.assertIn('main-out', uc_proxies.get('proxies', {}))
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                if proc.stdout:
                    proc.stdout.close()
                if proc.stderr:
                    proc.stderr.close()

            # 4. Verify MediaTek Filogic DSA br-lan nftables emission & router IPv6 GUA fib protection via real UCI
            nft_run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'nft/apply.uc'),
                    'nft-create-runtime-base-from-uci',
                    'ForkopTable',
                    'localv4',
                    'forkop_subnets',
                    'forkop_ports',
                    'forkop_ip_ports',
                    'forkop_interfaces',
                    '0x00100000',
                    '0x00200000',
                    '198.18.0.0/15',
                    '1602',
                    'localv6',
                    'forkop_subnets6',
                    'forkop_ip6_ports',
                    '2001:2::/112',
                    '::1',
                ],
                env=router.env(),
                text=True,
                capture_output=True,
                timeout=15,
            )
            self.assertEqual(nft_run.returncode, 0, nft_run.stderr)
            nft_rules = router.nft_log.read_text()
            self.assertIn('br-lan', nft_rules)
            self.assertIn('nft\tadd\trule\tinet\tForkopTable\tmangle\tiifname\t@forkop_interfaces\tfib\tdaddr\ttype\tlocal\treturn', nft_rules)
            self.assertIn('nft\tadd\trule\tinet\tForkopTable\tmangle_output\tfib\tdaddr\ttype\tlocal\treturn', nft_rules)
            self.assertIn('nft\tadd\trule\tinet\tForkopTable\thttps_prerouting\tfib\tdaddr\ttype\tlocal\treturn', nft_rules)

            # 5. Verify route_explain on TUF-AX4200 config (PS5 temporary rule -> main-out, IPv6 CIDR -> bypass-out, default -> direct-out, tracker -> blocked)
            for req_obj, expected_status, expected_out in [
                ({'device': '192.168.1.55', 'domain': 'store.playstation.com', 'port': 443, 'protocol': 'tcp'}, 'matched', 'main-out'),
                ({'device': '192.168.1.100', 'domain': 'mirror.example.net', 'destination_ip': '2001:db8:9999::abcd', 'port': 443, 'protocol': 'tcp'}, 'direct', 'bypass-out'),
                ({'device': '192.168.1.100', 'domain': 'unmatched.example.net', 'destination_ip': '8.8.8.8', 'port': 443, 'protocol': 'tcp'}, 'direct', 'direct-out'),
                ({'device': '192.168.1.100', 'domain': 'sub.ads-tracker.example', 'destination_ip': '198.51.100.42', 'port': 443, 'protocol': 'tcp'}, 'blocked', None),
            ]:
                exp = subprocess.run(
                    ['ucode', '-L', str(LIB), str(LIB / 'service/route_explain.uc'), 'explain', json.dumps(req_obj)],
                    env=router.env(),
                    text=True,
                    capture_output=True,
                    timeout=10,
                )
                self.assertEqual(exp.returncode, 0, exp.stderr)
                decision = json.loads(exp.stdout)['data']['decision']
                self.assertEqual(decision['status'], expected_status, f"unexpected status for {req_obj}: {decision}")
                if expected_out is not None:
                    self.assertEqual(decision['outbound'], expected_out)

            # 6. Verify zero credential leakage in masked router config & network exports
            masked_fkp = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/status.uc'), 'forkop-config-masked', str(router.uci_dir / 'forkop')],
                env=router.env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(masked_fkp.returncode, 0)
            for secret in [
                'TWljcm9TZWNyZXRLZXkxMg==',
                'tuf-ax4200-secret-token',
                'tuf-ax4200-local-secret',
                'MTIzNDU2Nzg5MDEyMzQ1Ng==',
            ]:
                self.assertNotIn(secret, masked_fkp.stdout, f"secret {secret} leaked in forkop-config-masked")

            masked_net = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/status.uc'), 'wan-config-masked', str(router.uci_dir / 'network')],
                env=router.env(),
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertNotIn('ROUTER_WG_PRIVATE_KEY_DO_NOT_LEAK', masked_net.stdout)

    def test_tier2_native_packs_on_tuf_ax4200(self):
        import base64

        awg_priv = base64.b64encode(b'\x42' * 32).decode()
        awg_pub = base64.b64encode(b'\x24' * 32).decode()
        warp_priv = base64.b64encode(b'\x55' * 32).decode()
        warp_pub = base64.b64encode(b'\x66' * 32).decode()

        with tempfile.TemporaryDirectory() as tmp:
            router = AsusTufAx4200OpenWrtEmulation(Path(tmp))
            router.setup()

            # OpenWrt 25.12.6 /etc/config/system with NTP timeserver pool
            (router.uci_dir / 'system').write_text(
                textwrap.dedent(
                    """\
                    config system
                    \toption hostname 'TUF-AX4200'
                    \toption timezone 'UTC'

                    config timeserver 'ntp'
                    \toption enabled '1'
                    \tlist server '0.openwrt.pool.ntp.org'
                    \tlist server '1.openwrt.pool.ntp.org'
                    """
                )
            )

            # Local Clash YAML rule-provider list on router filesystem
            clash_list = router.base / 'etc/forkop-steam.yaml'
            clash_list.write_text(
                textwrap.dedent(
                    """\
                    payload:
                      - DOMAIN-SUFFIX,steamcommunity.com
                      - IP-CIDR,203.0.113.0/25
                    """
                )
            )

            # Enable Tier-2 settings + Console Mode + AmneziaWG + Cloudflare WARP links on TUF-AX4200
            awg_link = (
                f"awg://{awg_priv}@198.51.100.77:51820"
                f"?publickey={awg_pub}&address=10.66.66.2/32&jc=4&jmin=40&jmax=70#TUF-AWG-Node"
            )
            warp_link = (
                f"warp://{warp_priv}@162.159.192.1:2408"
                f"?publickey={warp_pub}&address=172.16.0.2/32&id=reg-tuf-4200"
                f"&token=warp-secret-token-4200&jc=4&jmin=40&jmax=70#TUF-WARP-AWG"
            )
            forkop_cfg = router.uci_dir / 'forkop'
            cfg_text = forkop_cfg.read_text()
            cfg_text = cfg_text.replace(
                "\toption exclude_ntp '1'\n",
                "\toption exclude_ntp '1'\n\toption bittorrent_direct '1'\n\toption torrserver_direct '1'\n",
            )
            cfg_text = cfg_text.replace(
                "\tlist domain_suffix 'openai.com'\n",
                f"\tlist domain_suffix 'openai.com'\n"
                f"\tlist selector_proxy_links '{awg_link}'\n"
                f"\tlist selector_proxy_links '{warp_link}'\n",
            )
            cfg_text = cfg_text.replace(
                "\tlist fully_routed_ips '192.168.1.55/32'\n",
                "\toption console_mode '1'\n\tlist fully_routed_ips '192.168.1.55/32'\n\n"
                "config section 'steam_yaml'\n"
                "\toption label 'Steam Clash YAML'\n"
                "\toption enabled '1'\n"
                "\toption action 'connection'\n"
                "\toption next_target 'main'\n"
                f"\tlist domain_ip_lists '{clash_list}'\n",
            )
            forkop_cfg.write_text(cfg_text)

            ext_env = router.env(FORKOP_SING_BOX_BIN=str(router.sing_box_bin))
            gen_run = subprocess.run(
                [
                    'ucode',
                    '-L',
                    str(LIB),
                    str(LIB / 'singbox/generator.uc'),
                    'generate-config',
                    str(router.sing_box_cfg),
                    '192.168.1.1',
                    '0',
                    '1',
                ],
                env=ext_env,
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(gen_run.returncode, 0, f"{gen_run.stdout}\n{gen_run.stderr}")
            generated = json.loads(router.sing_box_cfg.read_text())

            # Pack 1: RFC 5180 FakeIPv6 2001:2::/112 + @timeserver bootstrap DNS
            fakeip_srv = next(
                (s for s in generated['dns'].get('servers', []) if s.get('type') == 'fakeip'),
                generated['dns'].get('fakeip', {}),
            )
            self.assertEqual(fakeip_srv.get('inet6_range'), '2001:2::/112')
            dns_blob = json.dumps(generated['dns']['rules'])
            self.assertIn('0.openwrt.pool.ntp.org', dns_blob)

            # Pack 2: Clash YAML rule-provider compiled into sing-box steam_yaml-lists-ruleset
            route_blob = json.dumps(generated['route']['rules'])
            self.assertIn('steam_yaml-lists-ruleset', route_blob)
            lists_rs = next(rs for rs in generated['route'].get('rule_set', []) if rs.get('tag') == 'steam_yaml-lists-ruleset')
            rs_text = Path(lists_rs['path']).read_text(encoding='utf-8')
            self.assertIn('steamcommunity.com', rs_text)
            self.assertIn('203.0.113.0/25', rs_text)
            self.assertIn('"protocol": "bittorrent"', json.dumps(generated['route']['rules'], indent=2))

            # Pack 5: Native AmneziaWG + Cloudflare WARP endpoints validated by REAL sing-box-extended check!
            endpoints = generated.get('endpoints', [])
            ep_types = {ep.get('type') for ep in endpoints}
            self.assertIn('wireguard', ep_types)
            if 'extended' in router.sing_box_bin.parent.name or 'extended' in str(router.sing_box_bin):
                self.assertIn('warp', ep_types)
                self.assertTrue(generated['experimental']['cache_file'].get('store_warp_config'))

            check = subprocess.run(
                [str(router.sing_box_bin), 'check', '-c', str(router.sing_box_cfg), '-D', str(router.base)],
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(check.returncode, 0, f"real sing-box check on Tier-2 endpoints failed:\n{check.stderr}")

            # Pack 3: Console Mode TCP/UDP/STUN split + BitTorrent direct in route_explain
            for req_obj, expected_status, expected_out, expected_reason in [
                ({'device': '192.168.1.55', 'domain': 'store.playstation.com', 'port': 443, 'protocol': 'tcp'}, 'matched', 'main-out', None),
                ({'device': '192.168.1.55', 'domain': 'stun.playstation.net', 'port': 3478, 'protocol': 'udp'}, 'direct', 'direct-out', 'console_udp_direct'),
                ({'device': '192.168.1.55', 'domain': 'stun.playstation.net', 'port': 3478, 'protocol': 'stun'}, 'direct', 'direct-out', 'console_udp_direct'),
                ({'device': '192.168.1.55', 'domain': 'tracker.example.org', 'port': 6881, 'protocol': 'bittorrent'}, 'direct', 'direct-out', 'bittorrent_direct'),
            ]:
                exp = subprocess.run(
                    ['ucode', '-L', str(LIB), str(LIB / 'service/route_explain.uc'), 'explain', json.dumps(req_obj)],
                    env=ext_env,
                    text=True,
                    capture_output=True,
                    timeout=10,
                )
                self.assertEqual(exp.returncode, 0, exp.stderr)
                payload = json.loads(exp.stdout)['data']
                self.assertEqual(payload['decision']['status'], expected_status, payload)
                self.assertEqual(payload['decision']['outbound'], expected_out, payload)
                if expected_reason:
                    reasons = [row.get('reason') for row in payload['trace']]
                    self.assertIn(expected_reason, reasons, payload)

            # Verify secret redaction covers WARP auth_token & AWG private_key while preserving 2001:2::/112
            masked_sb = subprocess.run(
                ['ucode', '-L', str(LIB), str(LIB / 'diagnostics/status.uc'), 'mask-sing-box-config', str(router.sing_box_cfg)],
                env=ext_env,
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(masked_sb.returncode, 0, masked_sb.stderr)
            self.assertNotIn('warp-secret-token-4200', masked_sb.stdout)
            self.assertNotIn(awg_priv, masked_sb.stdout)
            self.assertIn('2001:2::/112', masked_sb.stdout)


if __name__ == '__main__':
    unittest.main()
