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

    def test_current_xray_network_case_and_aliases_preserve_capabilities(self):
        # TransportProtocol.Build lowercases the network before resolving aliases.
        for network, local_transport in (
                ('TCP', 'tcp'), ('RAW', 'tcp'), ('WebSocket', 'ws'),
                ('WS', 'ws'), ('gRPC', 'grpc'), ('HTTPUpgrade', 'httpupgrade')):
            with self.subTest(network=network):
                self.configure(flow='', transport=local_transport, security='none')
                server = {'protocol': 'vless',
                          'settings': {'clients': [{'flow': ''}], 'decryption': 'none'},
                          'streamSettings': {'network': network, 'security': 'none'}}
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'verified', result)

    def test_current_xray_stream_method_overrides_network(self):
        # StreamConfig.Build assigns Method to Network before building the transport.
        for method, network, local_transport in (('raw', 'ws', 'tcp'), ('WebSocket', 'raw', 'ws')):
            with self.subTest(method=method, network=network):
                self.configure(flow='', transport=local_transport, security='none')
                server = {'protocol': 'vless',
                          'settings': {'clients': [{'flow': ''}], 'decryption': 'none'},
                          'streamSettings': {'method': method, 'network': network, 'security': 'none'}}
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'verified', result)

    def test_explicit_empty_xray_method_cannot_fall_back_to_network(self):
        # A non-nil Method pointer overrides Network even when the method is empty;
        # TransportProtocol.Build then rejects that unsupported empty name.
        self.configure(flow='', security='none')
        server = {'protocol': 'vless',
                  'settings': {'clients': [{'flow': ''}], 'decryption': 'none'},
                  'streamSettings': {'method': '', 'network': 'raw', 'security': 'none'}}
        result = self.probe(server)
        self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_reality_short_id_hex_case_and_zero_padding_preserve_byte_identity(self):
        # Xray decodes into an eight-byte zero-initialized buffer, not a variable string.
        for local_sid, server_sid in (
                ('aabb', 'AABB'), ('AABB', 'aabb'), ('aabb', 'aabb00'),
                ('aabb00', 'aabb'), ('aabb', 'aabb000000000000'), ('', '0000000000000000')):
            with self.subTest(local_sid=local_sid, server_sid=server_sid):
                config = self.configure()
                config['outbounds'][0]['tls']['reality']['short_id'] = local_sid
                self.write_config(config)
                server = copy.deepcopy(self.server)
                server['short_ids'] = [server_sid]
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'verified', result)

    def test_reality_malformed_equal_short_ids_cannot_be_certified(self):
        # Agreement between two invalid strings is not valid REALITY evidence.
        for short_id in ('zz', 'a', '001122334455667788'):
            with self.subTest(short_id=short_id):
                config = self.configure()
                config['outbounds'][0]['tls']['reality']['short_id'] = short_id
                self.write_config(config)
                server = copy.deepcopy(self.server)
                server['short_ids'] = [short_id]
                result = self.probe(server)
                self.assertNotEqual(result['data']['status'], 'verified', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_nonstring_reality_short_id_cannot_be_coerced_to_valid_zero_id(self):
        for invalid_id in (0, False, None, [], {}):
            with self.subTest(short_id=invalid_id):
                config = self.configure()
                config['outbounds'][0]['tls']['reality']['short_id'] = invalid_id
                self.write_config(config)
                server = copy.deepcopy(self.server)
                server['short_ids'] = ['0000000000000000']
                result = self.probe(server)
                self.assertNotEqual(result['data']['status'], 'verified', result)
        self.assertFalse((self.d / 'curl.log').exists(), 'Invalid typed IDs must not become empty valid IDs')

    def test_vision_over_non_raw_transport_cannot_be_certified(self):
        # With decryption none, Vision's inbound TCP path requires the direct TLS/REALITY connection.
        for transport, security in (('ws', 'tls'), ('httpupgrade', 'tls'), ('grpc', 'reality')):
            with self.subTest(transport=transport, security=security):
                self.configure(transport=transport, security=security)
                server = copy.deepcopy(self.server)
                server['transport'] = transport
                server['security'] = security
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_vision_with_tls_maximum_below_13_cannot_be_certified(self):
        # Check both sides independently: either ceiling makes a TLS 1.3 Vision handshake impossible.
        for limited_side in ('client', 'server'):
            with self.subTest(limited_side=limited_side):
                config = self.configure(security='tls')
                server = copy.deepcopy(self.server)
                server['security'] = 'tls'
                server['streamSettings'] = {'network': 'raw', 'security': 'tls', 'tlsSettings': {}}
                if limited_side == 'client':
                    config['outbounds'][0]['tls']['max_version'] = '1.2'
                    self.write_config(config)
                else:
                    server['streamSettings']['tlsSettings']['maxVersion'] = '1.2'
                result = self.probe(server)
                self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists())

    def test_current_xray_reality_rejects_native_confirmed_incompatible_stock_cores(self):
        # Pinned native handshake evidence: Xray v26.10.21's REALITY requires
        # X25519MLKEM768, absent from these two stock sing-box clients' wire hello.
        self.configure()
        for version in ('1.13.7', '1.14.3'):
            for xray_version in ('26.10.21', 'v26.10.21'):
                with self.subTest(client_version=version, xray_version=xray_version):
                    (self.d / 'sing-box').write_text('#!/bin/sh\necho "sing-box version ' + version + '"\n')
                    result = self.call(section='main', server=self.server, probe=True, domain='example.org',
                                       installed={'xray': xray_version, 'panel': '3.10.2'})
                    self.assertEqual(result['data']['status'], 'unsupported', result)
        self.assertFalse((self.d / 'curl.log').exists(), 'Known failed REALITY profile must not run HTTPS probe')

    def test_current_xray_tls_remains_probe_eligible_for_native_confirmed_stock_cores(self):
        # The same pinned clients pass actual TLS Vision: scope the guard to REALITY.
        self.configure(security='tls')
        server = copy.deepcopy(self.server)
        server['security'] = 'tls'
        for version in ('1.13.7', '1.14.3'):
            with self.subTest(client_version=version):
                (self.d / 'sing-box').write_text('#!/bin/sh\necho "sing-box version ' + version + '"\n')
                result = self.call(section='main', server=server, probe=True, domain='example.org',
                                   installed={'xray': '26.10.21', 'panel': '3.10.2'})
                self.assertEqual(result['data']['status'], 'verified', result)
                self.assertTrue(result['data']['probe']['reachable'], result)
                self.assertFalse(result['data']['future_compatibility_guaranteed'])

    def test_current_xray_reality_unknown_or_extended_core_requires_capability_evidence(self):
        self.configure()
        for version in ('1.13.18-extended-2.6.5', 'unknown'):
            with self.subTest(client_version=version):
                (self.d / 'sing-box').write_text('#!/bin/sh\necho "sing-box version ' + version + '"\n')
                result = self.call(section='main', server=self.server, probe=True, domain='example.org',
                                   installed={'xray': '26.10.21', 'panel': '3.10.2'})
                self.assertEqual(result['data']['status'], 'probe_required', result)
                self.assertFalse(result['data']['future_compatibility_guaranteed'])
        self.assertFalse((self.d / 'curl.log').exists(), 'An unconfirmed core suffix is not capability evidence')


if __name__ == '__main__':
    unittest.main()
