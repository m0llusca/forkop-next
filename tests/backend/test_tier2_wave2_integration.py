import fcntl
import http.server
import json
import os
import shutil
import socketserver
import stat
import subprocess
import tempfile
import textwrap
import threading
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FORKOP_BIN = REPO_ROOT / 'forkop/files/usr/bin/forkop'
FORKOP_LIB = REPO_ROOT / 'forkop/files/usr/lib'
CORES_DIR = Path(
    os.environ.get(
        'FORKOP_TEST_CORES_DIR',
        '/tmp/forkop-cores'
        if Path('/tmp/forkop-cores').exists()
        else str(Path.home() / '.cache/forkop-dev/forkop-cores'),
    )
)
SB_1137 = CORES_DIR / 'sing-box-1.13.7-linux-amd64/sing-box'
SB_1143 = CORES_DIR / 'sing-box-1.14.3-linux-amd64/sing-box'
SB_EXT = CORES_DIR / 'sing-box-1.14.3-extended-2.7.3-linux-amd64/sing-box'

# Deterministic 32-byte base64 keys for tests (non-secret synthetic test fixtures)
WG_PRIV_KEY = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
WG_PRIV_SLASH = '////YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
WG_PUB_KEY = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI='
WG_PSK_KEY = 'Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2M='


def runtime_env(extra=None):
    env = os.environ.copy()
    local_bin = str(Path.home() / '.local/bin')
    local_lib = str(Path.home() / '.local/lib')
    local_lib64 = str(Path.home() / '.local/lib64')
    env['PATH'] = f"{local_bin}:{env.get('PATH', '')}"
    ld_existing = env.get('LD_LIBRARY_PATH', '')
    env['LD_LIBRARY_PATH'] = f"{local_lib}:{local_lib64}" + (f":{ld_existing}" if ld_existing else '')
    env['FORKOP_LIB'] = str(FORKOP_LIB)
    env['FORKOP_BIN'] = str(FORKOP_BIN)
    if extra:
        env.update({k: str(v) for k, v in extra.items()})
    return env


def run_ucode(args, extra_env=None, input_text=None, check=False):
    cmd = ['ucode', '-L', str(FORKOP_LIB)] + [str(a) for a in args]
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env=runtime_env(extra_env),
        input=input_text,
        text=True,
        capture_output=True,
        check=check,
    )


def run_forkop(args, extra_env=None, check=False):
    cmd = ['ucode', '-L', str(FORKOP_LIB), str(FORKOP_BIN)] + [str(a) for a in args]
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


class _QuietHandler(http.server.BaseHTTPRequestHandler):
    routes = {}

    def do_GET(self):
        payload = self.routes.get(self.path)
        if payload is None:
            self.send_response(404)
            self.end_headers()
            return
        body = payload.encode('utf-8') if isinstance(payload, str) else payload
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


class LocalHTTPServer:
    def __init__(self, routes):
        handler_cls = type('ScopedHandler', (_QuietHandler,), {'routes': dict(routes)})
        self.httpd = socketserver.TCPServer(('127.0.0.1', 0), handler_cls)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.httpd.shutdown()
        self.httpd.server_close()


class Tier2Wave2IntegrationTests(unittest.TestCase):
    # =========================================================================
    # Task 1: /usr/bin/forkop CLI commands, timeout=25, no dnsmasq failsafe
    # =========================================================================
    def test_task1_cli_help_lists_new_tier2_commands(self):
        proc = run_forkop(['help'])
        self.assertNotEqual(proc.returncode, 0)
        for cmd_name in ('editor_preview', 'tspu_classify', 'generate_warp_profile'):
            self.assertIn(cmd_name, proc.stdout, f'{cmd_name} missing from forkop show_help()')

    def test_task1_cli_dispatch_timeout_25_and_no_failsafe_restore(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bin_dir = tmp_path / 'bin'
            bin_dir.mkdir()
            timeout_log = tmp_path / 'timeout.log'
            failsafe_marker = tmp_path / 'failsafe_triggered'

            write_executable(
                bin_dir / 'timeout',
                textwrap.dedent(f"""\
                    #!/bin/sh
                    printf '%s\\n' "$*" >> "{timeout_log}"
                    shift
                    exec "$@"
                """),
            )

            # Copy minimal lib overlay that records if dns/apply.uc failsafe-restore is called
            lib_dir = tmp_path / 'lib'
            shutil.copytree(FORKOP_LIB, lib_dir)
            (lib_dir / 'dns/apply.uc').write_text(
                f'let fs = require("fs"); if (ARGV[0] == "failsafe-restore") fs.writefile("{failsafe_marker}", "1");\n',
                encoding='utf-8',
            )

            base_path = f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}"
            env = {
                'PATH': base_path,
                'FORKOP_LIB': str(lib_dir),
                'FORKOP_UI_STATE_DIR': str(tmp_path / 'ui-state'),
            }

            # 1) tspu_classify via forkop CLI passes JSON arg properly (ARGV[1])
            p1 = subprocess.run(
                ['ucode', '-L', str(lib_dir), str(FORKOP_BIN), 'tspu_classify', '{"domain":"bad..domain"}'],
                cwd=REPO_ROOT,
                env=runtime_env(env),
                text=True,
                capture_output=True,
            )
            out1 = json.loads(p1.stdout)
            self.assertFalse(out1['success'])
            self.assertEqual(out1['error'], 'invalid_domain')

            # 2) generate_warp_profile via forkop CLI passes JSON arg properly
            p2 = subprocess.run(
                ['ucode', '-L', str(lib_dir), str(FORKOP_BIN), 'generate_warp_profile', '"not_an_object"'],
                cwd=REPO_ROOT,
                env=runtime_env(env),
                text=True,
                capture_output=True,
            )
            out2 = json.loads(p2.stdout)
            self.assertFalse(out2['success'])
            self.assertEqual(out2['error'], 'invalid_payload')

            # 3) editor_preview via forkop CLI passes request_id arg properly
            p3 = subprocess.run(
                ['ucode', '-L', str(lib_dir), str(FORKOP_BIN), 'editor_preview', 'bad/request'],
                cwd=REPO_ROOT,
                env=runtime_env(env),
                text=True,
                capture_output=True,
            )
            out3 = json.loads(p3.stdout)
            self.assertFalse(out3['success'])

            # Verify all 3 commands used `timeout 25 ...`
            logged = timeout_log.read_text(encoding='utf-8').splitlines()
            self.assertEqual(len(logged), 3, f'Expected 3 timeout invocations, got: {logged}')
            for line in logged:
                self.assertTrue(line.startswith('25 ucode '), f'Expected timeout 25, got: {line}')

            # Verify missing module / non-zero exit on helper commands NEVER triggers dnsmasq failsafe
            (lib_dir / 'warp/register.uc').unlink()
            p_fail = subprocess.run(
                ['ucode', '-L', str(lib_dir), str(FORKOP_BIN), 'generate_warp_profile', '{}'],
                cwd=REPO_ROOT,
                env=runtime_env(env),
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(p_fail.returncode, 0)
            self.assertFalse(failsafe_marker.exists(), 'Helper commands must NEVER trigger dnsmasq failsafe restore')

    # =========================================================================
    # Task 2: service/next.uc unlocked tspu_classify & gaming_apply console_mode
    # =========================================================================
    def test_task2_next_tspu_classify_unlocked_and_gaming_console_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            next_dir = tmp_path / 'next'
            next_dir.mkdir(mode=0o700)
            (next_dir / 'profiles').mkdir(mode=0o700)
            cfg_file = tmp_path / 'forkop'
            activate_hook = tmp_path / 'activate.sh'
            mock_curl = tmp_path / 'mock_curl.sh'

            write_executable(activate_hook, '#!/bin/sh\nexit 0\n')
            write_executable(
                mock_curl,
                textwrap.dedent("""\
                    #!/bin/sh
                    printf '{"exitcode":0,"response_code":206,"size_download":65536,"speed_download":500000,"time_namelookup":0.01,"time_connect":0.02,"time_appconnect":0.04,"time_total":0.08,"num_connects":1,"remote_ip":"93.184.216.34"}'
                    exit 0
                """),
            )

            cfg_file.write_text(
                textwrap.dedent("""\
                    config settings 'settings'
                    \toption dns_type 'udp'
                    \tlist dns_server '1.1.1.1'
                    \tlist bootstrap_dns_server '8.8.8.8'

                    config section 'main'
                    \toption enabled '1'
                    \toption action 'connection'
                    \tlist selector_proxy_links 'socks5://198.51.100.10:1080#Test'
                    \tlist domain_suffix 'example.org'
                """),
                encoding='utf-8',
            )

            env = {
                'FORKOP_NEXT_DIR': str(next_dir),
                'FORKOP_CONFIG_FILE': str(cfg_file),
                'FORKOP_NEXT_ACTIVATE': str(activate_hook),
                'FORKOP_TSPU_CURL_BIN': str(mock_curl),
                'FORKOP_TSPU_UPLINK_TARGETS': 'up',
            }

            # Hold operation.lock exclusively to prove tspu_classify bypasses the lock
            lock_path = next_dir / 'operation.lock'
            with open(lock_path, 'a+', encoding='utf-8') as lock_fh:
                fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

                busy_proc = run_forkop(['next', 'status', '{}'], extra_env=env)
                busy_res = json.loads(busy_proc.stdout)
                self.assertFalse(busy_res['success'])
                self.assertEqual(busy_res['error'], 'busy')

                probe_proc = run_forkop(
                    ['next', 'tspu_classify', json.dumps({'domain': 'example.com'})],
                    extra_env=env,
                )
                probe_res = json.loads(probe_proc.stdout)
                self.assertTrue(probe_res['success'], probe_proc.stdout + probe_proc.stderr)
                self.assertEqual(probe_res['data']['verdict'], 'ok')

            # Unlocked: test gaming_apply with playstation + console_mode
            res_ps = json.loads(
                run_forkop(
                    [
                        'next',
                        'gaming_apply',
                        json.dumps({
                            'section': 'main',
                            'preset': 'playstation',
                            'device': '192.168.1.50',
                            'console_mode': True,
                        }),
                    ],
                    extra_env=env,
                ).stdout
            )
            self.assertTrue(res_ps['success'], res_ps)
            text_after_ps = cfg_file.read_text(encoding='utf-8')
            self.assertIn("option console_mode '1'", text_after_ps)
            self.assertIn('playstation.net', text_after_ps)

            # Test preset == 'console' without device -> must fail
            res_no_dev = json.loads(
                run_forkop(
                    [
                        'next',
                        'gaming_apply',
                        json.dumps({
                            'section': 'main',
                            'preset': 'console',
                            'console_mode': True,
                        }),
                    ],
                    extra_env=env,
                ).stdout
            )
            self.assertFalse(res_no_dev['success'])

            # Test preset == 'console' with device + console_mode -> creates fully_routed_ips + console_mode='1' without domain_suffix
            res_console = json.loads(
                run_forkop(
                    [
                        'next',
                        'gaming_apply',
                        json.dumps({
                            'section': 'main',
                            'preset': 'console',
                            'device': '192.168.1.77',
                            'console_mode': '1',
                        }),
                    ],
                    extra_env=env,
                ).stdout
            )
            self.assertTrue(res_console['success'], res_console)
            text_after_console = cfg_file.read_text(encoding='utf-8')
            self.assertIn('192.168.1.77', text_after_console)
            self.assertIn('fully_routed_ips', text_after_console)

    # =========================================================================
    # Task 3: evidence.uc + cache.uc (shrink guard, alias history, preview proxy) + editor.uc
    # =========================================================================
    def test_task3_evidence_shrink_guard_alias_history_and_editor_preview(self):
        # 3a) evidence.uc supports 'subscription_shrunk'
        with tempfile.TemporaryDirectory() as tmp:
            ev_dir = Path(tmp) / 'evidence'
            proc = run_ucode(
                [
                    '-e',
                    textwrap.dedent("""\
                        let ev = require('subscription.evidence');
                        ev.record('main-subscription-1', 'id1', { attemptedAt: 1700000100, succeeded: false, reason: 'subscription_shrunk' });
                        print(sprintf('%J\\n', ev.read('main-subscription-1', 'id1')));
                    """),
                ],
                extra_env={'FORKOP_SOURCE_EVIDENCE_DIR': str(ev_dir)},
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            ev_data = json.loads(proc.stdout)
            self.assertEqual(ev_data['error'], 'subscription_shrunk')

        # 3b & 3c) cache.uc <50% shrink guard + canonical filter_identity alias history
        routes = {}
        six_nodes = '\n'.join(
            f'vless://11111111-1111-1111-1111-11111111111{i}@198.51.100.{10 + i}:443?security=tls&sni=node{i}.example.com&type=tcp#DE-Node-{i}-v1'
            for i in range(1, 7)
        )
        two_nodes = '\n'.join(
            f'vless://11111111-1111-1111-1111-11111111111{i}@198.51.100.{10 + i}:443?security=tls&sni=node{i}.example.com&type=tcp#DE-Node-{i}-v1'
            for i in range(1, 3)
        )
        six_nodes_renamed = '\n'.join(
            f'vless://11111111-1111-1111-1111-11111111111{i}@198.51.100.{10 + i}:443?security=tls&sni=node{i}.example.com&type=tcp#DE-Node-{i}-v2'
            for i in range(1, 7)
        )
        routes['/sub'] = six_nodes

        with LocalHTTPServer(routes) as srv, tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            uci_dir = tmp_path / 'uci'
            uci_dir.mkdir()
            runtime_sub = tmp_path / 'subs'
            persist_sub = tmp_path / 'persist'
            sec_cache = tmp_path / 'sec-cache'
            ev_dir = tmp_path / 'evidence'
            state_dir = tmp_path / 'state'
            sub_url = f'http://127.0.0.1:{srv.port}/sub'

            (uci_dir / 'forkop').write_text(
                textwrap.dedent(f"""\
                    config settings 'settings'
                    \toption dns_type 'udp'
                    \tlist dns_server '1.1.1.1'
                    \tlist bootstrap_dns_server '8.8.8.8'

                    config section 'main'
                    \toption enabled '1'
                    \toption action 'connection'
                    \tlist subscription_urls '{sub_url}'

                    config section 'proxy_sec'
                    \toption enabled '1'
                    \toption action 'connection'
                    \tlist selector_proxy_links 'socks5://198.51.100.99:1080#ProxySec'
                """),
                encoding='utf-8',
            )

            cache_env = {
                'FORKOP_UCI_CONFIG_DIR': str(uci_dir),
                'TMP_SUBSCRIPTION_FOLDER': str(runtime_sub),
                'FORKOP_PERSISTENT_SUBSCRIPTION_CACHE_DIR': str(persist_sub),
                'FORKOP_SECTION_CACHE_DIR': str(sec_cache),
                'FORKOP_SOURCE_EVIDENCE_DIR': str(ev_dir),
                'FORKOP_RUNTIME_STATE_DIR': str(state_dir),
                'FORKOP_SUBSCRIPTION_UPDATE_STATE_DIR': str(tmp_path / 'upd-state'),
                'FORKOP_SUBSCRIPTION_METADATA_DIR': str(tmp_path / 'sub-meta'),
                'FORKOP_OUTBOUND_METADATA_DIR': str(tmp_path / 'out-meta'),
                'no_proxy': '127.0.0.1,localhost',
                'NO_PROXY': '127.0.0.1,localhost',
            }

            # Initial download (6 nodes)
            p_init = run_ucode(
                [FORKOP_LIB / 'subscription/cache.uc', 'update-source', 'main', '1', sub_url, 'runtime'],
                extra_env=cache_env,
            )
            self.assertEqual(p_init.returncode, 0, p_init.stderr)
            cached_json_path = runtime_sub / 'main-subscription-1.json'
            persist_json_path = persist_sub / 'main-subscription-1.json'
            first_doc = json.loads(cached_json_path.read_text(encoding='utf-8'))
            self.assertEqual(len(first_doc['outbounds']), 6)
            self.assertTrue(first_doc['outbounds'][0].get('__forkop_filter_id', '').startswith('cid1:'))

            # Rename nodes (6 -> 6 with new tags): verify __forkop_filter_names carries old alias
            srv.httpd.RequestHandlerClass.routes['/sub'] = six_nodes_renamed
            p_rename = run_ucode(
                [FORKOP_LIB / 'subscription/cache.uc', 'update-source', 'main', '1', sub_url, 'runtime'],
                extra_env=cache_env,
            )
            self.assertEqual(p_rename.returncode, 0, p_rename.stderr)
            renamed_doc = json.loads(cached_json_path.read_text(encoding='utf-8'))
            self.assertEqual(
                renamed_doc['outbounds'][0]['__forkop_filter_id'],
                first_doc['outbounds'][0]['__forkop_filter_id'],
            )
            self.assertIn('DE-Node-1-v1', renamed_doc['outbounds'][0].get('__forkop_filter_names', []))

            # Shrink 6 -> 2 (<50%): must fail, record 'subscription_shrunk', and preserve both runtime & persistent caches
            srv.httpd.RequestHandlerClass.routes['/sub'] = two_nodes
            p_shrink = run_ucode(
                [FORKOP_LIB / 'subscription/cache.uc', 'update-source', 'main', '1', sub_url, 'runtime'],
                extra_env=cache_env,
            )
            self.assertNotEqual(p_shrink.returncode, 0, 'Shrink <50% must fail update-source')
            self.assertEqual(len(json.loads(cached_json_path.read_text(encoding='utf-8'))['outbounds']), 6)
            self.assertEqual(len(json.loads(persist_json_path.read_text(encoding='utf-8'))['outbounds']), 6)

            ev_check = run_ucode([FORKOP_LIB / 'subscription/evidence.uc', 'read-section', 'main'], extra_env=cache_env)
            ev_sec = json.loads(ev_check.stdout)
            self.assertEqual(ev_sec['data']['sources'][0]['evidence']['error'], 'subscription_shrunk')

            # Allow shrink when FORKOP_ALLOW_SUBSCRIPTION_SHRINK=1
            allow_env = dict(cache_env, FORKOP_ALLOW_SUBSCRIPTION_SHRINK='1')
            p_allow = run_ucode(
                [FORKOP_LIB / 'subscription/cache.uc', 'update-source', 'main', '1', sub_url, 'runtime'],
                extra_env=allow_env,
            )
            self.assertEqual(p_allow.returncode, 0, p_allow.stderr)
            self.assertEqual(len(json.loads(cached_json_path.read_text(encoding='utf-8'))['outbounds']), 2)

            # 3d & 3e) subscription/editor.uc preview(request_id) + fail-closed proxy guard + credential non-leakage
            ui_state_dir = tmp_path / 'ui-state'
            ui_state_dir.mkdir(mode=0o700)
            secret_uuid = '99999999-8888-7777-6666-555555555555'
            srv.httpd.RequestHandlerClass.routes['/preview-sub'] = (
                f'vless://{secret_uuid}@198.51.100.42:443?security=tls&sni=preview.example.com&type=tcp#%F0%9F%87%A9%F0%9F%87%AA%20Frankfurt%20Preview\n'
            )

            req_id = 'req_preview_01'
            req_file = ui_state_dir / f'{req_id}.json'
            req_file.write_text(
                json.dumps({
                    'section_id': 'main',
                    'sources': [
                        {
                            'url': f'http://127.0.0.1:{srv.port}/preview-sub',
                            'prefix': 'ProviderA',
                        }
                    ],
                    'section': {
                        'detect_server_country': 'flag_emoji',
                        'selector_proxy_links': [
                            f'wireguard://{WG_PRIV_KEY}@198.51.100.88:51820?address=10.0.0.2/32&publickey={WG_PUB_KEY}#%F0%9F%87%BA%F0%9F%87%B8%20Manual%20WG'
                        ],
                    },
                }),
                encoding='utf-8',
            )

            preview_env = dict(
                cache_env,
                FORKOP_UI_STATE_DIR=str(ui_state_dir),
                FORKOP_EDITOR_ALLOW_LOOPBACK='1',
            )
            p_prev = run_forkop(['editor_preview', req_id], extra_env=preview_env)
            self.assertEqual(p_prev.returncode, 0, p_prev.stdout + p_prev.stderr)
            self.assertFalse(req_file.exists(), 'editor_preview must immediately unlink request file')
            prev_out = json.loads(p_prev.stdout)
            self.assertTrue(prev_out['success'], prev_out)
            self.assertEqual(prev_out['count'], 2)
            self.assertEqual(prev_out['data']['count'], 2)
            self.assertIsInstance(prev_out['countries'], dict)
            self.assertIn('US', [str(v).upper() for v in prev_out['countries'].values()])
            raw_stdout = p_prev.stdout
            self.assertNotIn(secret_uuid, raw_stdout)
            self.assertNotIn(WG_PRIV_KEY, raw_stdout)
            self.assertNotIn('198.51.100.42', raw_stdout)

            # Fail-closed proxy guard when download_via_proxy_enabled == '1' and proxy is down
            req_proxy_id = 'req_proxy_down_02'
            req_proxy_file = ui_state_dir / f'{req_proxy_id}.json'
            req_proxy_file.write_text(
                json.dumps({
                    'section_id': 'main',
                    'sources': [
                        {
                            'url': f'http://127.0.0.1:{srv.port}/preview-sub',
                            'download_via_proxy_enabled': '1',
                            'download_via_proxy_section': 'proxy_sec',
                        }
                    ],
                }),
                encoding='utf-8',
            )
            p_proxy_fail = run_forkop(['editor_preview', req_proxy_id], extra_env=preview_env)
            self.assertFalse(req_proxy_file.exists(), 'editor_preview must unlink request file even on failure')
            proxy_fail_out = json.loads(p_proxy_fail.stdout)
            self.assertFalse(proxy_fail_out['success'])
            self.assertEqual(proxy_fail_out['error'], 'download_proxy_unavailable')

    # =========================================================================
    # Task 4: share_link.uc & parser.uc (WG/AWG/WARP URI, wg-quick .conf, Clash YAML, JSON endpoints[])
    # =========================================================================
    def test_task4_share_link_and_parser_all_wireguard_amneziawg_warp_formats(self):
        # 4a) share_link.uc is_copyable_link + serialize_outbound_link
        proc_sl = run_ucode(
            [
                '-e',
                textwrap.dedent(f"""\
                    let sl = require('subscription.share_link');
                    let wg = require('singbox.wireguard');
                    let results = {{
                        copy_wg: sl.is_copyable_link('wireguard://abc@1.2.3.4:51820'),
                        copy_wg_short: sl.is_copyable_link('wg://abc@1.2.3.4:51820'),
                        copy_awg: sl.is_copyable_link('awg://abc@1.2.3.4:51820'),
                        copy_amneziawg: sl.is_copyable_link('amneziawg://abc@1.2.3.4:51820'),
                        copy_warp: sl.is_copyable_link('warp://162.159.192.1:2408?privatekey=x'),
                        ser_wg: sl.serialize_outbound_link(wg.parse_share_link('amneziawg://{WG_PRIV_KEY}@198.51.100.10:51820?address=10.8.0.2/32&publickey={WG_PUB_KEY}&jc=4&jmin=40&jmax=70#AWG-Node')),
                        ser_warp: sl.serialize_outbound_link(wg.parse_share_link('warp://162.159.192.1:2408?privatekey={WG_PRIV_KEY}&publickey={WG_PUB_KEY}&address=172.16.0.2/32&id=reg1&token=tok1#WARP-Node'))
                    }};
                    print(sprintf('%J\\n', results));
                """),
            ]
        )
        self.assertEqual(proc_sl.returncode, 0, proc_sl.stderr)
        sl_res = json.loads(proc_sl.stdout)
        for k in ('copy_wg', 'copy_wg_short', 'copy_awg', 'copy_amneziawg', 'copy_warp'):
            self.assertTrue(sl_res[k], f'{k} expected True')
        self.assertTrue(sl_res['ser_wg'].startswith('amneziawg://'))
        self.assertTrue(sl_res['ser_warp'].startswith('warp://'))

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)

            # 4b) runtime-outbounds-equal ignores __forkop_filter_id, __forkop_filter_names, __forkop_endpoint
            f_left = tmp_path / 'left.json'
            f_right = tmp_path / 'right.json'
            base_node = {'type': 'vless', 'tag': 'N1', 'server': '198.51.100.1', 'server_port': 443, 'uuid': 'u1'}
            f_left.write_text(json.dumps({'version': 1, 'outbounds': [base_node]}), encoding='utf-8')
            annotated_node = dict(
                base_node,
                __forkop_filter_id='cid1:abcdef',
                __forkop_filter_names=['Old Name'],
                __forkop_endpoint=True,
            )
            f_right.write_text(json.dumps({'version': 1, 'outbounds': [annotated_node]}), encoding='utf-8')
            eq_proc = run_ucode([FORKOP_LIB / 'subscription/parser.uc', 'runtime-outbounds-equal', f_left, f_right])
            self.assertEqual(eq_proc.returncode, 0, 'canonical_runtime_value must ignore __forkop_* fields')

            # 4c) URI list with wireguard://, wg://, awg://, amneziawg://, warp://
            uri_in = tmp_path / 'uris.txt'
            uri_out = tmp_path / 'uris.json'
            uri_in.write_text(
                '\n'.join([
                    f'wireguard://{WG_PRIV_KEY}@198.51.100.11:51820?address=10.0.0.2/32&publickey={WG_PUB_KEY}#WG1',
                    f'wg://{WG_PRIV_KEY}@198.51.100.12:51820?address=10.0.0.3/32&publickey={WG_PUB_KEY}#WG2',
                    f'awg://{WG_PRIV_KEY}@198.51.100.13:51820?address=10.0.0.4/32&publickey={WG_PUB_KEY}&jc=3&jmin=20&jmax=50#AWG1',
                    f'amneziawg://{WG_PRIV_KEY}@198.51.100.14:51820?address=10.0.0.5/32&publickey={WG_PUB_KEY}&jc=4&jmin=40&jmax=70#AWG2',
                    f'warp://162.159.192.1:2408?privatekey={WG_PRIV_KEY}&publickey={WG_PUB_KEY}&address=172.16.0.2/32&id=reg1&token=tok1#WARP1',
                ])
                + '\n',
                encoding='utf-8',
            )
            p_uri = run_ucode([FORKOP_LIB / 'subscription/parser.uc', 'normalize-content-validated', uri_in, uri_out])
            self.assertEqual(p_uri.returncode, 0, p_uri.stderr)
            uri_doc = json.loads(uri_out.read_text(encoding='utf-8'))
            self.assertEqual(len(uri_doc['outbounds']), 5)

            # 4d) Raw wg-quick / AmneziaWG [Interface] .conf subscription
            conf_in = tmp_path / 'wg.conf'
            conf_out = tmp_path / 'wg.json'
            conf_in.write_text(
                textwrap.dedent(f"""\
                    # Profile: AmneziaWG-Conf-Node
                    [Interface]
                    PrivateKey = {WG_PRIV_KEY}
                    Address = 10.66.66.2/32, fd42:42:42::2/128
                    MTU = 1380
                    Jc = 4
                    Jmin = 40
                    Jmax = 70
                    S1 = 15
                    S2 = 25
                    H1 = 101
                    H2 = 102
                    H3 = 103
                    H4 = 104

                    [Peer]
                    PublicKey = {WG_PUB_KEY}
                    PresharedKey = {WG_PSK_KEY}
                    Endpoint = 198.51.100.55:51820
                    AllowedIPs = 0.0.0.0/0, ::/0
                    PersistentKeepalive = 25
                """),
                encoding='utf-8',
            )
            p_conf = run_ucode([FORKOP_LIB / 'subscription/parser.uc', 'normalize-content-validated', conf_in, conf_out])
            self.assertEqual(p_conf.returncode, 0, p_conf.stderr)
            conf_doc = json.loads(conf_out.read_text(encoding='utf-8'))
            self.assertEqual(len(conf_doc['outbounds']), 1)
            self.assertEqual(conf_doc['outbounds'][0]['type'], 'wireguard')
            self.assertEqual(conf_doc['outbounds'][0]['amnezia']['jc'], 4)

            # 4e) Clash YAML with type: wireguard + amnezia-wg-option
            clash_in = tmp_path / 'clash.yaml'
            clash_out = tmp_path / 'clash.json'
            clash_in.write_text(
                textwrap.dedent(f"""\
                    proxies:
                      - name: Clash-AWG-DE
                        type: wireguard
                        server: 198.51.100.77
                        port: 51820
                        ip: 10.10.0.2/32
                        private-key: "{WG_PRIV_KEY}"
                        public-key: "{WG_PUB_KEY}"
                        mtu: 1400
                        amnezia-wg-option:
                          jc: 5
                          jmin: 50
                          jmax: 100
                """),
                encoding='utf-8',
            )
            p_clash = run_ucode([FORKOP_LIB / 'subscription/parser.uc', 'normalize-content-validated', clash_in, clash_out])
            self.assertEqual(p_clash.returncode, 0, p_clash.stderr)
            clash_doc = json.loads(clash_out.read_text(encoding='utf-8'))
            self.assertEqual(len(clash_doc['outbounds']), 1)
            self.assertEqual(clash_doc['outbounds'][0]['tag'], 'Clash-AWG-DE')
            self.assertEqual(clash_doc['outbounds'][0]['amnezia']['jc'], 5)

            # 4f) sing-box JSON subscription with endpoints[] alongside outbounds[]
            sb_in = tmp_path / 'sb.json'
            sb_out = tmp_path / 'sb_norm.json'
            sb_in.write_text(
                json.dumps({
                    'outbounds': [
                        {'type': 'socks', 'tag': 'Socks-1', 'server': '198.51.100.20', 'server_port': 1080}
                    ],
                    'endpoints': [
                        {
                            'type': 'wireguard',
                            'tag': 'WG-Endpoint-1',
                            'address': ['10.0.0.2/32'],
                            'private_key': WG_PRIV_KEY,
                            'peers': [{'address': '198.51.100.21', 'port': 51820, 'public_key': WG_PUB_KEY}],
                        },
                        {
                            'type': 'warp',
                            'tag': 'WARP-Endpoint-1',
                            'address': '162.159.192.1',
                            'port': 2408,
                            'profile': {'id': 'reg1', 'auth_token': 'tok1', 'private_key': WG_PRIV_KEY},
                        },
                    ],
                }),
                encoding='utf-8',
            )
            p_sb = run_ucode([FORKOP_LIB / 'subscription/parser.uc', 'normalize-content-validated', sb_in, sb_out])
            self.assertEqual(p_sb.returncode, 0, p_sb.stderr)
            sb_doc = json.loads(sb_out.read_text(encoding='utf-8'))
            tags = [item['tag'] for item in sb_doc['outbounds']]
            self.assertIn('Socks-1', tags)
            self.assertIn('WG-Endpoint-1', tags)
            self.assertIn('WARP-Endpoint-1', tags)

    # =========================================================================
    # Task 5: singbox/runtime.uc, service/ui.uc, service/compatibility.uc
    # =========================================================================
    def test_task5_capabilities_stock_vs_extended_cores(self):
        self.assertTrue(SB_1137.is_file(), f'Missing cached core {SB_1137}')
        self.assertTrue(SB_1143.is_file(), f'Missing cached core {SB_1143}')
        self.assertTrue(SB_EXT.is_file(), f'Missing cached core {SB_EXT}')

        for core_bin, expect_ext in ((SB_1137, False), (SB_1143, False), (SB_EXT, True)):
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                bin_dir = tmp_path / 'bin'
                bin_dir.mkdir()
                (bin_dir / 'sing-box').symlink_to(core_bin)
                env = {
                    'PATH': f"{bin_dir}:{Path.home() / '.local/bin'}:{os.environ.get('PATH', '')}",
                    'SB_VARIANT_STATE_FILE': str(tmp_path / 'no-variant'),
                    'SB_VERSION_STATE_FILE': str(tmp_path / 'no-version'),
                    'FORKOP_UI_STATE_DIR': str(tmp_path / 'ui-state'),
                }

                # singbox/runtime.uc CLI modes
                p_wg = run_ucode([FORKOP_LIB / 'singbox/runtime.uc', 'supports-wireguard'], extra_env=env)
                p_awg = run_ucode([FORKOP_LIB / 'singbox/runtime.uc', 'supports-amneziawg'], extra_env=env)
                p_warp = run_ucode([FORKOP_LIB / 'singbox/runtime.uc', 'supports-native-warp'], extra_env=env)
                self.assertEqual(p_wg.returncode, 0, f'WireGuard must be supported on {core_bin}')
                if expect_ext:
                    self.assertEqual(p_awg.returncode, 0)
                    self.assertEqual(p_warp.returncode, 0)
                else:
                    self.assertNotEqual(p_awg.returncode, 0)
                    self.assertNotEqual(p_warp.returncode, 0)

                # service/ui.uc get-ui-capabilities
                p_ui = run_ucode([FORKOP_LIB / 'service/ui.uc', 'get-ui-capabilities'], extra_env=env)
                self.assertEqual(p_ui.returncode, 0, p_ui.stderr)
                ui_caps = json.loads(p_ui.stdout)
                self.assertEqual(ui_caps['supports_wireguard'], 1)
                self.assertEqual(ui_caps['supports_amneziawg'], 1 if expect_ext else 0)
                self.assertEqual(ui_caps['supports_warp'], 1 if expect_ext else 0)
                self.assertEqual(ui_caps['sing_box_extended'], 1 if expect_ext else 0)

                # service/compatibility.uc compatibility_check
                p_compat = run_ucode(
                    [
                        '-e',
                        textwrap.dedent("""\
                            let compat = require('service.compatibility');
                            let res = compat.handle('compatibility_check', {
                                client: { protocol: 'vless', transport: 'tcp', security: 'tls', sni: 'example.com' },
                                server: { protocol: 'vless', transport: 'tcp', security: 'tls', server_names: ['example.com'] }
                            });
                            print(sprintf('%J\\n', res));
                        """),
                    ],
                    extra_env=env,
                )
                self.assertEqual(p_compat.returncode, 0, p_compat.stderr)
                compat_data = json.loads(p_compat.stdout)['data']
                client_info = compat_data['client']
                self.assertTrue(bool(client_info['supports_wireguard']))
                self.assertEqual(bool(client_info['supports_amneziawg']), expect_ext)
                self.assertEqual(bool(client_info['supports_warp']), expect_ext)

    # =========================================================================
    # Task 6: generator.uc (@timeserver NTP, console_mode, Clash YAML, section-cache, endpoints + real sing-box check)
    # =========================================================================
    def test_task6_ntp_console_mode_clash_yaml_section_cache_and_real_sing_box_endpoints(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            ruleset_dir = tmp_path / 'rulesets'
            ruleset_dir.mkdir()
            sub_dir = tmp_path / 'subs'
            sub_dir.mkdir()
            sec_cache_dir = tmp_path / 'section-cache'
            sec_cache_dir.mkdir()

            # Local Clash YAML list with domains + IP-CIDRs
            clash_list = tmp_path / 'discord_voice.yaml'
            clash_list.write_text(
                textwrap.dedent("""\
                    payload:
                      - '+.discord.gg'
                      - 'DOMAIN,discordapp.com'
                      - 'IP-CIDR,66.22.192.0/18,no-resolve'
                      - 'IP-CIDR6,2606:4700::/32'
                """),
                encoding='utf-8',
            )

            # Verify nft/apply.uc split-domain-subnet-file works on Clash YAML too
            dom_out = tmp_path / 'doms.txt'
            sub4_out = tmp_path / 'sub4.txt'
            sub6_out = tmp_path / 'sub6.txt'
            p_split = run_ucode(
                [FORKOP_LIB / 'nft/apply.uc', 'split-domain-subnet-file', clash_list, dom_out, sub4_out, sub6_out]
            )
            self.assertEqual(p_split.returncode, 0, p_split.stderr)
            self.assertIn('discord.gg', dom_out.read_text(encoding='utf-8'))
            self.assertIn('66.22.192.0/18', sub4_out.read_text(encoding='utf-8'))
            self.assertIn('2606:4700::/32', sub6_out.read_text(encoding='utf-8'))

            # Prepare cached subscription with alias history, WG, AWG, WARP, and loopback SSRF peer
            (sub_dir / 'main-subscription-1.url').write_text('https://sub.example.com/feed\n', encoding='utf-8')
            (sub_dir / 'main-subscription-1.user_agent').write_text('sing-box/1.14.3\n', encoding='utf-8')
            (sub_dir / 'main-subscription-1.hwid').write_text('auto\n', encoding='utf-8')
            (sub_dir / 'main-subscription-1.json').write_text(
                json.dumps({
                    'version': 1,
                    'format': 'sing-box-json',
                    'outbounds': [
                        {
                            'type': 'vless',
                            'tag': 'DE Current Tag',
                            'server': '198.51.100.10',
                            'server_port': 443,
                            'uuid': '11111111-2222-3333-4444-555555555555',
                            'tls': {'enabled': True, 'server_name': 'de.example.com'},
                            '__forkop_filter_id': 'cid1:0123456789abcdef01234567',
                            '__forkop_filter_names': ['DE Old Name'],
                        },
                        {
                            'type': 'wireguard',
                            'tag': 'Sub WG Plain',
                            'address': ['10.20.0.2/32'],
                            'private_key': WG_PRIV_KEY,
                            'peers': [{'address': '198.51.100.20', 'port': 51820, 'public_key': WG_PUB_KEY}],
                        },
                        {
                            'type': 'wireguard',
                            'tag': 'Sub AWG Node',
                            'address': ['10.20.0.3/32'],
                            'private_key': WG_PRIV_KEY,
                            'amnezia': {'jc': 4, 'jmin': 40, 'jmax': 70},
                            'peers': [{'address': '198.51.100.21', 'port': 51820, 'public_key': WG_PUB_KEY}],
                        },
                        {
                            'type': 'warp',
                            'tag': 'Sub WARP Node',
                            'address': '162.159.192.1',
                            'port': 2408,
                            'local_address': ['172.16.0.2/32'],
                            'private_key': WG_PRIV_KEY,
                            'peer_public_key': WG_PUB_KEY,
                            'profile': {'id': 'reg1', 'auth_token': 'tok1', 'private_key': WG_PRIV_KEY},
                        },
                        {
                            'type': 'wireguard',
                            'tag': 'SSRF Loopback WG',
                            'address': ['10.20.0.9/32'],
                            'private_key': WG_PRIV_KEY,
                            'peers': [{'address': '127.0.0.1', 'port': 51820, 'public_key': WG_PUB_KEY}],
                        },
                    ],
                }),
                encoding='utf-8',
            )

            # 6a) Fixture WITHOUT `system` must NOT emit any NTP bootstrap rule
            fixture_no_ntp = tmp_path / 'fixture_no_ntp.json'
            fixture_no_ntp.write_text(
                json.dumps({
                    'settings': {
                        '.name': 'settings',
                        '.type': 'settings',
                        'dns_type': 'udp',
                        'dns_server': ['1.1.1.1'],
                        'bootstrap_dns_server': ['8.8.8.8'],
                    },
                    'section': [
                        {
                            '.name': 'relay',
                            '.type': 'section',
                            'enabled': '1',
                            'action': 'connection',
                            'selector_proxy_links': ['socks5://198.51.100.90:1080#Relay'],
                            'domain_suffix': ['relay.example.com'],
                        }
                    ],
                }),
                encoding='utf-8',
            )
            cfg_no_ntp = tmp_path / 'out_no_ntp.json'
            p_no_ntp = run_ucode(
                [FORKOP_LIB / 'singbox/generator.uc', 'generate-config-fixture', fixture_no_ntp, cfg_no_ntp, 'wan', '1']
            )
            self.assertEqual(p_no_ntp.returncode, 0, p_no_ntp.stderr)
            doc_no_ntp = json.loads(cfg_no_ntp.read_text(encoding='utf-8'))
            ntp_rules_absent = [
                r for r in doc_no_ntp['dns']['rules'] if r.get('server') == 'bootstrap-dns-server' and r.get('inbound') == 'dns-in'
            ]
            self.assertEqual(ntp_rules_absent, [], 'Fixtures without system.ntp must stay 100% unchanged')

            # 6b) Full fixture WITH `system`, `console_mode`, `domain_ip_lists` (.yaml), rename filter, detour cascade, WG/AWG/WARP
            fixture_ext = tmp_path / 'fixture_ext.json'
            fixture_ext_obj = {
                'system': {
                    'ntp': {
                        '.name': 'ntp',
                        '.type': 'timeserver',
                        'enabled': '1',
                        'server': ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '162.159.200.1'],
                    }
                },
                'settings': {
                    '.name': 'settings',
                    '.type': 'settings',
                    'dns_type': 'udp',
                    'dns_server': ['1.1.1.1'],
                    'bootstrap_dns_server': ['8.8.8.8'],
                    'cache_path': str(tmp_path / 'cache.db'),
                },
                'section': [
                    {
                        '.name': 'relay',
                        '.type': 'section',
                        'enabled': '1',
                        'action': 'connection',
                        'selector_proxy_links': ['socks5://198.51.100.90:1080#Relay'],
                        'domain_suffix': ['relay.example.com'],
                    },
                    {
                        '.name': 'main',
                        '.type': 'section',
                        'enabled': '1',
                        'action': 'connection',
                        'subscription_urls': ['https://sub.example.com/feed'],
                        'domain_ip_lists': [str(clash_list)],
                        'urltest_enabled': '1',
                    },
                    {
                        '.name': 'cascaded_wg',
                        '.type': 'section',
                        'enabled': '1',
                        'action': 'connection',
                        'outbound_detour_enabled': '1',
                        'outbound_detour_section': 'relay',
                        'selector_proxy_links': [
                            f'wireguard://{WG_PRIV_KEY}@198.51.100.30:51820?address=10.30.0.2/32&publickey={WG_PUB_KEY}#Cascaded-WG'
                        ],
                        'domain_suffix': ['cascaded.example.com'],
                    },
                    {
                        '.name': 'console_sec',
                        '.type': 'section',
                        'enabled': '1',
                        'action': 'connection',
                        'console_mode': '1',
                        'selector_proxy_links': ['socks5://198.51.100.91:1080#ConsoleProxy'],
                        'fully_routed_ips': ['192.168.1.50'],
                        'domain_suffix': ['playstation.net'],
                    },
                ],
                'urltest': [
                    {
                        '.name': 'ut_renamed',
                        '.type': 'urltest',
                        'section': 'main',
                        'name': 'Renamed Match Group',
                        'filter_mode': 'include',
                        'include_outbounds': ['DE Old Name'],
                        'urltest_check_interval': '3m',
                        'tolerance': '50',
                        'testing_url': 'https://www.gstatic.com/generate_204',
                    }
                ],
                'priority_group': [
                    {
                        '.name': 'pg_main',
                        '.type': 'priority_group',
                        'section': 'main',
                        'name': 'Main Priority',
                        'pin_dashboard': '1',
                    }
                ],
                'priority_level': [
                    {
                        '.name': 'pl_wg',
                        '.type': 'priority_level',
                        'group': 'pg_main',
                        'name': 'WG Tier',
                        'order': '1',
                        'filter_mode': 'include',
                        'include_proxy_parameters': '1',
                        'include_protocols': ['wireguard', 'amneziawg', 'warp'],
                    }
                ],
            }
            fixture_ext.write_text(json.dumps(fixture_ext_obj), encoding='utf-8')

            gen_env = {
                'TMP_RULESET_FOLDER': str(ruleset_dir),
                'TMP_SUBSCRIPTION_FOLDER': str(sub_dir),
                'FORKOP_SECTION_CACHE_DIR': str(sec_cache_dir),
                'FORKOP_STRICT_SUBSCRIPTION_IPS': '1',
            }

            cfg_ext = tmp_path / 'config_extended.json'
            p_gen_ext = run_ucode(
                [FORKOP_LIB / 'singbox/generator.uc', 'generate-config-fixture', fixture_ext, cfg_ext, 'wan', '1'],
                extra_env=dict(gen_env, FORKOP_SING_BOX_VERSION='1.14.3-extended-2.7.3'),
            )
            self.assertEqual(p_gen_ext.returncode, 0, p_gen_ext.stderr)
            doc_ext = json.loads(cfg_ext.read_text(encoding='utf-8'))

            # Check @timeserver NTP bootstrap DNS rule (IPs skipped, domains included)
            ntp_rules = [
                r for r in doc_ext['dns']['rules'] if r.get('server') == 'bootstrap-dns-server' and r.get('inbound') == 'dns-in'
            ]
            self.assertEqual(len(ntp_rules), 1)
            ntp_domains = ntp_rules[0]['domain'] if isinstance(ntp_rules[0]['domain'], list) else [ntp_rules[0]['domain']]
            self.assertEqual(ntp_domains, ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org'])

            # Check console_mode TCP/UDP split routes
            route_rules = doc_ext['route']['rules']
            console_udp_ips = [
                r for r in route_rules
                if r.get('source_ip_cidr') in ('192.168.1.50', ['192.168.1.50'], ['192.168.1.50/32'])
                and r.get('network') == 'udp'
                and r.get('outbound') == 'direct-out'
            ]
            console_tcp_ips = [
                r for r in route_rules
                if r.get('source_ip_cidr') in ('192.168.1.50', ['192.168.1.50'], ['192.168.1.50/32'])
                and r.get('network') == 'tcp'
                and r.get('outbound') != 'direct-out'
            ]
            self.assertEqual(len(console_udp_ips), 1, 'console_mode must send fully_routed_ips UDP to direct-out')
            self.assertEqual(len(console_tcp_ips), 1, 'console_mode must send fully_routed_ips TCP to section outbound')

            console_udp_dom = [
                r for r in route_rules
                if r.get('domain_suffix') in ('playstation.net', ['playstation.net'])
                and r.get('network') == 'udp'
                and r.get('outbound') == 'direct-out'
            ]
            console_tcp_dom = [
                r for r in route_rules
                if r.get('domain_suffix') in ('playstation.net', ['playstation.net'])
                and r.get('network') == 'tcp'
                and r.get('outbound') != 'direct-out'
            ]
            self.assertEqual(len(console_udp_dom), 1)
            self.assertEqual(len(console_tcp_dom), 1)

            # Check endpoints[], store_warp_config, detour cascade, and SSRF loopback drop
            endpoints_by_tag = {ep['tag']: ep for ep in doc_ext.get('endpoints', [])}
            self.assertIn('Sub WG Plain', endpoints_by_tag)
            self.assertIn('Sub AWG Node', endpoints_by_tag)
            self.assertEqual(endpoints_by_tag['Sub AWG Node']['amnezia']['jc'], 4)
            self.assertIn('Sub WARP Node', endpoints_by_tag)
            self.assertEqual(endpoints_by_tag['Sub WARP Node']['type'], 'warp')
            self.assertNotIn('SSRF Loopback WG', endpoints_by_tag, 'Loopback peer address must be blocked by SSRF check')
            self.assertTrue(doc_ext['experimental']['cache_file'].get('store_warp_config'))

            cascaded_eps = [ep for ep in doc_ext['endpoints'] if 'Cascaded-WG' in ep['tag'] or ep['tag'].startswith('cascaded_wg')]
            self.assertEqual(len(cascaded_eps), 1)
            self.assertTrue(cascaded_eps[0].get('detour'), 'Cascaded endpoint must receive detour tag')
            self.assertNotIn('routing_mark', cascaded_eps[0])
            self.assertNotIn('bind_interface', cascaded_eps[0])

            # Check ZERO __forkop_* fields anywhere in config
            raw_ext_str = cfg_ext.read_text(encoding='utf-8')
            self.assertNotIn('__forkop_', raw_ext_str)

            # Check section-cache metadata (filterIds, filterNames, selectorTag, selectorOutbounds, urltestTags, priorityTags) + Pin Guard
            sec_state = json.loads((sec_cache_dir / 'main.json').read_text(encoding='utf-8'))
            meta = sec_state['outboundMetadata']
            self.assertEqual(meta['filterIds']['DE Current Tag'], 'cid1:0123456789abcdef01234567')
            self.assertIn('DE Old Name', meta['filterNames']['DE Current Tag'])
            self.assertTrue(sec_state.get('selectorTag'))
            self.assertTrue(len(sec_state.get('selectorOutbounds', [])) >= 4)
            self.assertTrue(len(sec_state.get('urltestTags', [])) >= 1)
            self.assertTrue(len(sec_state.get('priorityTags', [])) == 1)

            # Verify ut_renamed matched 'DE Current Tag' via alias 'DE Old Name'!
            ut_outbounds = [o for o in doc_ext['outbounds'] if o.get('type') == 'urltest' and 'DE Current Tag' in o.get('outbounds', [])]
            self.assertTrue(len(ut_outbounds) >= 1, 'Alias history must resolve renamed outbound in URLTest filter')

            # Verify priority.uc pin_guard_sections_from_cache reads generated section-cache!
            p_pin = run_ucode(
                [FORKOP_LIB / 'singbox/priority.uc', 'pin-guard-sections'],
                extra_env={'FORKOP_SECTION_CACHE_DIR': str(sec_cache_dir)},
            )
            self.assertEqual(p_pin.returncode, 0, p_pin.stderr)
            pin_sections = {entry['section']: entry for entry in json.loads(p_pin.stdout)}
            self.assertIn('main', pin_sections)
            self.assertTrue(pin_sections['main']['selectorTag'])
            self.assertTrue(len(pin_sections['main']['urltestTags']) >= 1)
            self.assertEqual(len(pin_sections['main']['priorityTags']), 1)

            # REAL `sing-box check -c` on extended core!
            chk_ext = subprocess.run([str(SB_EXT), 'check', '-c', str(cfg_ext)], capture_output=True, text=True)
            self.assertEqual(chk_ext.returncode, 0, f'sing-box-extended check failed: {chk_ext.stderr}')

            # Generate for STOCK cores (1.13.7 and 1.14.3): skips Sub AWG Node, converts Sub WARP Node to wireguard fallback, passes `sing-box check`!
            cfg_stock = tmp_path / 'config_stock.json'
            p_gen_stock = run_ucode(
                [FORKOP_LIB / 'singbox/generator.uc', 'generate-config-fixture', fixture_ext, cfg_stock, 'wan', '0'],
                extra_env=dict(gen_env, FORKOP_SING_BOX_VERSION='1.14.3'),
            )
            self.assertEqual(p_gen_stock.returncode, 0, p_gen_stock.stderr)
            doc_stock = json.loads(cfg_stock.read_text(encoding='utf-8'))
            stock_eps = {ep['tag']: ep for ep in doc_stock.get('endpoints', [])}
            self.assertIn('Sub WG Plain', stock_eps)
            self.assertNotIn('Sub AWG Node', stock_eps, 'Stock core must skip AmneziaWG subscription nodes')
            self.assertIn('Sub WARP Node', stock_eps)
            self.assertEqual(stock_eps['Sub WARP Node']['type'], 'wireguard', 'Stock core must use wireguard fallback for WARP')
            self.assertNotIn('store_warp_config', doc_stock['experimental']['cache_file'])

            for stock_bin in (SB_1137, SB_1143):
                chk_stock = subprocess.run([str(stock_bin), 'check', '-c', str(cfg_stock)], capture_output=True, text=True)
                self.assertEqual(chk_stock.returncode, 0, f'{stock_bin.name} check failed: {chk_stock.stderr}')

            # Verify service/state.uc sing-box-signature changes when console_mode toggles
            sig1 = run_ucode([FORKOP_LIB / 'service/state.uc', 'sing-box-signature-fixture', fixture_ext]).stdout.strip()
            fixture_ext_obj['section'][3]['console_mode'] = '0'
            fixture_ext_off = tmp_path / 'fixture_ext_off.json'
            fixture_ext_off.write_text(json.dumps(fixture_ext_obj), encoding='utf-8')
            sig2 = run_ucode([FORKOP_LIB / 'service/state.uc', 'sing-box-signature-fixture', fixture_ext_off]).stdout.strip()
            self.assertNotEqual(sig1, sig2, 'console_mode must be included in sing-box-signature')

            # Verify isolated FORKOP_UCI_CONFIG_DIR without `system` file does NOT leak host /etc/config/system
            iso_uci = tmp_path / 'iso_uci'
            iso_uci.mkdir()
            (iso_uci / 'forkop').write_text(
                textwrap.dedent("""\
                    config settings 'settings'
                    \toption dns_type 'udp'
                    \tlist dns_server '1.1.1.1'
                    \tlist bootstrap_dns_server '8.8.8.8'

                    config section 's1'
                    \toption enabled '1'
                    \toption action 'connection'
                    \tlist selector_proxy_links 'socks5://198.51.100.10:1080#S1'
                    \tlist domain_suffix 'example.com'
                """),
                encoding='utf-8',
            )
            cfg_iso = tmp_path / 'cfg_iso.json'
            p_iso = run_ucode(
                [FORKOP_LIB / 'singbox/generator.uc', 'generate-config', cfg_iso, 'wan', '1'],
                extra_env=dict(gen_env, FORKOP_UCI_CONFIG_DIR=str(iso_uci)),
            )
            self.assertEqual(p_iso.returncode, 0, p_iso.stderr)
            doc_iso = json.loads(cfg_iso.read_text(encoding='utf-8'))
            iso_ntp = [
                r for r in doc_iso['dns']['rules'] if r.get('server') == 'bootstrap-dns-server' and r.get('inbound') == 'dns-in'
            ]
            self.assertEqual(iso_ntp, [], 'Isolated FORKOP_UCI_CONFIG_DIR without system file must not read /etc/config/system')

    # =========================================================================
    # Task 7: validator.uc, extended_preview.uc, diagnostics/runtime.uc & status.uc
    # =========================================================================
    def test_task7_validator_extended_preview_and_diagnostics(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)

            # 7a) validator.uc accepts console_mode, bittorrent_direct, torrserver_direct, .yaml/.yml lists, WG/AWG/WARP protocols & links
            valid_fixture = tmp_path / 'valid.json'
            valid_fixture.write_text(
                json.dumps({
                    'settings': {
                        '.name': 'settings',
                        '.type': 'settings',
                        'dns_type': 'udp',
                        'dns_server': ['1.1.1.1'],
                        'bootstrap_dns_server': ['8.8.8.8'],
                        'bittorrent_direct': '1',
                        'torrserver_direct': '1',
                        'torrserver_cgroup': 'services/torrserver',
                    },
                    'section': [
                        {
                            '.name': 'main',
                            '.type': 'section',
                            'enabled': '1',
                            'action': 'connection',
                            'console_mode': '1',
                            'domain_ip_lists': ['/etc/forkop/rules.yaml', '/etc/forkop/more.yml'],
                            'selector_proxy_links': [
                                f'wireguard://{WG_PRIV_SLASH}@198.51.100.10:51820?address=10.0.0.2/32&publickey={WG_PUB_KEY}#WG',
                                f'warp://162.159.192.1:2408?privatekey={WG_PRIV_KEY}&publickey={WG_PUB_KEY}&address=172.16.0.2/32#WARP',
                            ],
                            'outbound_jsons': [
                                json.dumps({
                                    'type': 'wireguard',
                                    'tag': 'JSON-WG',
                                    'address': ['10.0.0.5/32'],
                                    'private_key': WG_PRIV_KEY,
                                    'peers': [{'address': '198.51.100.25', 'port': 51820, 'public_key': WG_PUB_KEY}],
                                })
                            ],
                            'dashboard_filter_mode': 'include',
                            'dashboard_include_proxy_parameters': '1',
                            'dashboard_include_protocols': ['wireguard', 'amneziawg', 'warp'],
                        }
                    ],
                }),
                encoding='utf-8',
            )
            p_val = run_ucode(
                [FORKOP_LIB / 'config/validator.uc', 'validate-runtime-fixture', valid_fixture, '{}'],
                extra_env={'FORKOP_SING_BOX_VERSION': '1.14.3-extended-2.7.3'},
            )
            self.assertEqual(p_val.returncode, 0, p_val.stdout + p_val.stderr)

            # Reject path traversal in torrserver_cgroup
            bad_cgroup = tmp_path / 'bad_cgroup.json'
            bad_obj = json.loads(valid_fixture.read_text(encoding='utf-8'))
            bad_obj['settings']['torrserver_cgroup'] = '../escape'
            bad_cgroup.write_text(json.dumps(bad_obj), encoding='utf-8')
            p_bad = run_ucode([FORKOP_LIB / 'config/validator.uc', 'validate-runtime-fixture', bad_cgroup, '{}'])
            self.assertNotEqual(p_bad.returncode, 0, 'torrserver_cgroup with .. must be rejected')

            # 7b) extended_preview.uc accepts WG/AWG/WARP links (even with `/` in base64 private key) & redacts leaked secrets
            uci_dir = tmp_path / 'uci'
            uci_dir.mkdir()
            sec_cache = tmp_path / 'sec-cache'
            sec_cache.mkdir()
            sub_dir = tmp_path / 'subs'
            sub_dir.mkdir()

            secret_warp_tok = 'warp_secret_auth_token_98765'
            wg_link_slash = f'wireguard://{WG_PRIV_SLASH}@198.51.100.10:51820?address=10.0.0.2/32&publickey={WG_PUB_KEY}#Safe-WG-Name'
            warp_link = f'warp://162.159.192.1:2408?privatekey={WG_PRIV_KEY}&publickey={WG_PUB_KEY}&address=172.16.0.2/32&token={secret_warp_tok}#Leak-{secret_warp_tok}'

            (uci_dir / 'forkop').write_text(
                textwrap.dedent(f"""\
                    config settings 'settings'
                    \toption dns_type 'udp'
                    \tlist dns_server '1.1.1.1'
                    \tlist bootstrap_dns_server '8.8.8.8'

                    config section 'main'
                    \toption enabled '1'
                    \toption action 'connection'
                    \tlist selector_proxy_links '{wg_link_slash}'
                    \tlist selector_proxy_links '{warp_link}'
                    \tlist domain_suffix 'example.com'
                """),
                encoding='utf-8',
            )

            ep_env = {
                'FORKOP_UCI_CONFIG_DIR': str(uci_dir),
                'TMP_SUBSCRIPTION_FOLDER': str(sub_dir),
                'FORKOP_SECTION_CACHE_DIR': str(sec_cache),
                'TMP_RULESET_FOLDER': str(tmp_path / 'rulesets'),
            }
            gen_cfg = tmp_path / 'gen_ep.json'
            p_gen = run_ucode([FORKOP_LIB / 'singbox/generator.uc', 'generate-config', gen_cfg, 'wan', '1'], extra_env=ep_env)
            self.assertEqual(p_gen.returncode, 0, p_gen.stderr)

            req_ep = {
                'schema': 1,
                'section': 'main',
                'requestId': 'req_ep_1',
                'draft': {
                    'section': {'urltest_enabled': '0'},
                    'urltest': [],
                    'priority_group': [],
                    'priority_level': [],
                },
            }
            p_ep = run_ucode([FORKOP_LIB / 'service/extended_preview.uc', 'preview', json.dumps(req_ep)], extra_env=ep_env)
            self.assertEqual(p_ep.returncode, 0, p_ep.stderr)
            ep_res = json.loads(p_ep.stdout)
            self.assertTrue(ep_res['success'], ep_res)
            cand_names = [c['name'] for c in ep_res['data']['candidates']]
            self.assertIn('Safe-WG-Name', cand_names, f'context.certain must remain true for WG links with slash keys: {cand_names}')
            self.assertNotIn(secret_warp_tok, p_ep.stdout, 'extended_preview must redact WARP auth token from candidate names')

            # 7c) diagnostics/status.uc & diagnostics/runtime.uc: 2001:2::/48 non-public, 2001:2::/112 fakeip, secret masking
            p_fake6_ok = run_ucode([FORKOP_LIB / 'diagnostics/status.uc', 'fakeip-address-status', '2001:2::1234'])
            self.assertEqual(p_fake6_ok.stdout.strip(), 'true')
            p_fake6_bad = run_ucode([FORKOP_LIB / 'diagnostics/status.uc', 'fakeip-address-status', 'fc00::1234'])
            self.assertEqual(p_fake6_bad.stdout.strip(), 'false')
            p_fake6_wide = run_ucode([FORKOP_LIB / 'diagnostics/status.uc', 'fakeip-address-status', '2001:2:0:1::1'])
            self.assertEqual(p_fake6_wide.stdout.strip(), 'false')

            raw_sb_cfg = tmp_path / 'raw_sb.json'
            raw_sb_cfg.write_text(
                json.dumps({
                    'endpoints': [
                        {
                            'type': 'warp',
                            'tag': 'warp-ep',
                            'private_key': WG_PRIV_KEY,
                            'peers': [{'pre_shared_key': WG_PSK_KEY, 'reserved': [1, 2, 3]}],
                            'profile': {
                                'auth_token': 'secret_tok_123',
                                'license_key': 'secret_lic_456',
                            },
                            'header_protection_key': 'secret_hpk_789',
                        }
                    ]
                }),
                encoding='utf-8',
            )
            p_mask = run_ucode([FORKOP_LIB / 'diagnostics/status.uc', 'mask-sing-box-config', raw_sb_cfg])
            self.assertEqual(p_mask.returncode, 0, p_mask.stderr)
            masked_str = p_mask.stdout
            for secret in (WG_PRIV_KEY, WG_PSK_KEY, 'secret_tok_123', 'secret_lic_456', 'secret_hpk_789'):
                self.assertNotIn(secret, masked_str, f'{secret} must be masked in mask-sing-box-config')
            masked_doc = json.loads(masked_str)
            self.assertEqual(masked_doc['endpoints'][0]['peers'][0]['reserved'], 'MASKED')


if __name__ == '__main__':
    unittest.main()
