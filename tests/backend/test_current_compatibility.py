"""Behavioral fixtures pinned to Xray v26.10.21 and 3x-ui v3.10.2.

Uses the real ucode service through the existing process-boundary harness.
The finite representation matrix is deterministic and requires no PBT dependency.
"""
import copy
import json
import unittest
import test_compatibility as fixtures


class CurrentCompatibilityTests(unittest.TestCase):
    setUp = fixtures.CompatibilityTests.setUp
    tearDown = fixtures.CompatibilityTests.tearDown
    call = fixtures.CompatibilityTests.call

    def configure(self, flow='xtls-rprx-vision', transport='tcp', security='reality'):
        out = {'type': 'vless', 'tag': 'main-out', 'flow': flow}
        if transport != 'tcp':
            out['transport'] = {'type': transport}
        if security != 'none':
            out['tls'] = {'enabled': True, 'server_name': 'example.org'}
            if security == 'reality':
                out['tls']['reality'] = {'enabled': True, 'public_key': 'PUBLICSECRET', 'short_id': 'aabb'}
        config = {
            'outbounds': [out],
            'inbounds': [{'type': 'mixed', 'tag': 'main-mixed-in', 'listen': '127.0.0.1', 'listen_port': 12345}],
            'route': {'rules': [{'inbound': 'main-mixed-in', 'outbound': 'main-out', 'action': 'route'}]},
        }
        self.write_config(config)
        return config

    def write_config(self, config):
        (self.d / 'config.json').write_text(json.dumps(config))

    def inbound(self):
        return {
            'protocol': 'vless',
            'settings': {'clients': [{'id': 'UUIDSECRET', 'flow': 'xtls-rprx-vision'}], 'decryption': 'none'},
            'streamSettings': {'network': 'raw', 'security': 'reality', 'realitySettings': {
                'serverNames': ['example.org'], 'shortIds': ['aabb'], 'privateKey': 'PRIVATESECRET'}},
        }

    def probe(self, server):
        return self.call(section='main', server=server, probe=True, domain='example.org')

    def test_current_panel_json_strings_preserve_inbound_capabilities(self):
        # model.Inbound.Settings and StreamSettings are strings in 3x-ui v3.10.2.
        self.configure()
        for settings_string in (False, True):
            for stream_string in (False, True):
                with self.subTest(settings_string=settings_string, stream_string=stream_string):
                    server = self.inbound()
                    if settings_string:
                        server['settings'] = json.dumps(server['settings'])
                    if stream_string:
                        server['streamSettings'] = json.dumps(server['streamSettings'])
                    result = self.probe(server)
                    self.assertEqual(result['data']['status'], 'verified', result)
                    for secret in ('UUIDSECRET', 'PRIVATESECRET', 'PUBLICSECRET', 'aabb', 'example.org'):
                        self.assertNotIn(secret, json.dumps(result))

    def test_current_xray_settings_users_alias_and_default_flow_are_respected(self):
        # v26.10.21 supports settings.users and inherits settings.flow when user.flow is empty.
        self.configure()
        for users_key in ('clients', 'users'):
            with self.subTest(users_key=users_key):
                server = self.inbound()
                server['settings'] = {users_key: [{'id': 'UUIDSECRET', 'flow': ''}],
                                      'flow': 'xtls-rprx-vision', 'decryption': 'none'}
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'verified', result)

    def test_multiple_unselected_clients_cannot_certify_empty_flow(self):
        self.configure(flow='')
        server = self.inbound()
        server['settings']['clients'] = [
            {'id': 'CLIENTONE', 'flow': 'xtls-rprx-vision'},
            {'id': 'CLIENTTWO', 'flow': ''},
        ]
        result = self.probe(server)
        self.assertNotEqual(result['data']['status'], 'verified', result)
        self.assertFalse((self.d / 'curl.log').exists(), 'Ambiguous client must not start a probe')

    def test_malformed_panel_json_cannot_default_to_plain_vless(self):
        self.configure(flow='', security='none')
        for key in ('settings', 'streamSettings'):
            with self.subTest(key=key):
                server = {'protocol': 'vless', 'settings': {'clients': [{'flow': ''}], 'decryption': 'none'},
                          'streamSettings': {'network': 'raw', 'security': 'none'}}
                server[key] = '{broken-json'
                result = self.probe(server)
                self.assertNotEqual(result.get('data', {}).get('status'), 'verified', result)
        self.assertFalse((self.d / 'curl.log').exists(), 'Invalid metadata must not start a probe')

    def test_metadata_cannot_certify_reality_over_websocket_or_httpupgrade(self):
        # Xray v26.10.21 only allows REALITY over RAW, XHTTP and gRPC.
        for transport in ('ws', 'httpupgrade'):
            with self.subTest(transport=transport):
                self.configure(flow='', transport=transport)
                server = copy.deepcopy(self.server)
                server['transport'] = transport
                server['flow'] = ''
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_removed_current_xray_http_transport_cannot_be_certified(self):
        self.configure(flow='', transport='http', security='none')
        server = {'protocol': 'vless', 'transport': 'http', 'flow': '', 'encryption': 'none', 'security': 'none'}
        result = self.probe(server)
        self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_websocket_alias_matches_current_xray_transport(self):
        self.configure(flow='', transport='ws', security='none')
        server = {'protocol': 'vless', 'settings': {'clients': [{'flow': ''}], 'decryption': 'none'},
                  'streamSettings': {'network': 'websocket', 'security': 'none'}}
        result = self.probe(server)
        self.assertEqual(result['data']['status'], 'verified', result)

    def test_second_same_port_inbound_cannot_change_certified_probe_outbound(self):
        config = self.configure()
        # probe.uc uses main-mixed-in, while the old compatibility adapter picks the last port match.
        config['outbounds'][0]['transport'] = {'type': 'ws'}
        config['outbounds'].append({'type': 'vless', 'tag': 'other-out', 'flow': 'xtls-rprx-vision',
                                    'tls': copy.deepcopy(config['outbounds'][0]['tls'])})
        config['inbounds'].append({'type': 'mixed', 'tag': 'other-in', 'listen': '127.0.0.2', 'listen_port': 12345})
        config['route']['rules'].append({'inbound': 'other-in', 'outbound': 'other-out', 'action': 'route'})
        self.write_config(config)
        result = self.probe(self.server)
        self.assertNotEqual(result['data']['status'], 'verified', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_nonterminal_route_options_before_section_preserves_certification(self):
        config = self.configure()
        config['route']['rules'].insert(0, {'action': 'route-options', 'tls_fragment': True})
        # Non-terminal route-options is safe; this control prevents blanket rejection of all rules.
        self.write_config(config)
        result = self.probe(self.server)
        self.assertEqual(result['data']['status'], 'verified', result)


if __name__ == '__main__':
    unittest.main()
