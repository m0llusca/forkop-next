"""Policy behavior: real UCI config changes verified by profiles export.
Breaks caught: duplicate device routes, unsafe expiry, preset routing wrong domains.
"""
import test_next_profiles as profiles

class NextPolicies(profiles.NextProfiles):
    def setUp(self):
        super().setUp()
        self.original += "config section 'main'\n\toption enabled '1'\n\toption action 'connection'\n\tlist selector_proxy_links 'vless://00000000-0000-4000-8000-000000000001@127.0.0.1:443?security=none'\n"
        self.config.write_text(self.original)

    def test_device_assignment_updates_real_uci(self):
        self.assertTrue(self.call('device_set', {'address': '192.168.1.25', 'section': 'main'})['success'])
        self.assertIn('192.168.1.25', self.config.read_text())
        items = self.call('devices')['data']['items']
        self.assertEqual(items, [{'address': '192.168.1.25', 'section': 'main'}])

    def test_invalid_device_is_rejected_without_config_change(self):
        result = self.call('device_set', {'address': '999.1.1.1', 'section': 'main'})
        self.assertEqual(result['error'], 'invalid_address')
        self.assertEqual(self.config.read_text(), self.original)

    def test_temporary_rule_has_expiry_and_delete_restores_policy(self):
        result = self.call('temporary_add', {'domain': 'example.com', 'section': 'main', 'ttl': 3600})
        self.assertTrue(result['success'])
        item = self.call('temporary_list')['data']['items'][0]
        self.assertEqual(item['domain'], 'example.com')
        self.assertGreater(item['expires'], 0)
        self.assertTrue(self.call('temporary_delete', {'id': item['id']})['success'])
        self.assertEqual(self.call('temporary_list')['data']['items'], [])

    def test_zero_ttl_does_not_create_permanent_rule(self):
        self.assertEqual(self.call('temporary_add', {'domain': 'example.com', 'section': 'main', 'ttl': 0})['error'], 'invalid_ttl')
        self.assertEqual(self.config.read_text(), self.original)

    def test_gaming_preset_routes_store_domains_not_all_device_traffic(self):
        result = self.call('gaming_apply', {'preset': 'steam', 'device': '192.168.1.25', 'section': 'main'})
        self.assertTrue(result['success'])
        content = self.config.read_text()
        self.assertIn('steampowered.com', content)
        self.assertNotIn("list fully_routed_ips '192.168.1.25'", content)



    def test_direct_device_route_is_explicit_bypass(self):
        result = self.call('device_set', {'address': '192.168.1.25', 'section': 'direct'})
        self.assertTrue(result['success'])
        self.assertIn("bypass", self.config.read_text())

    def test_assigning_second_direct_device_preserves_first_assignment(self):
        for address in ['192.168.1.25', '192.168.1.26']:
            self.assertTrue(self.call('device_set', {'address': address, 'section': 'direct'})['success'])
        self.assertEqual(self.call('devices')['data']['items'], [
            {'address': '192.168.1.25', 'section': 'nxt_direct'},
            {'address': '192.168.1.26', 'section': 'nxt_direct'},
        ])

    def test_clearing_device_restores_normal_rules(self):
        self.call('device_set', {'address': '192.168.1.25', 'section': 'main'})
        self.assertTrue(self.call('device_set', {'address': '192.168.1.25', 'section': ''})['success'])
        self.assertEqual(self.call('devices')['data']['items'], [])

    def recommendation(self):
        self.env['FORKOP_SMART_DETECT_FILE'] = str(self.dir / 'recommendations.json')
        self.env['FORKOP_SMART_DETECT_NOW'] = '1000'
        self.call('recommendation_record', {'domain': 'example.org', 'direct_ok': False, 'proxy_ok': True})
        self.env['FORKOP_SMART_DETECT_NOW'] = '1120'
        self.call('recommendation_record', {'domain': 'example.org', 'direct_ok': False, 'proxy_ok': True})
        return self.call('recommendations')['data']['recommendations'][0]

    def test_accept_recommendation_changes_real_routing_only_on_explicit_accept(self):
        item = self.recommendation()
        self.assertEqual(self.config.read_text(), self.original)
        result = self.call('recommendation_accept', {'id': item['id'], 'section': 'main'})
        self.assertTrue(result['success'])
        self.assertIn('example.org', self.config.read_text())
        self.assertEqual(self.call('recommendations')['data']['recommendations'], [])

    def test_failed_recommendation_apply_preserves_pending_and_config(self):
        item = self.recommendation()
        self.hook.write_text('#!/bin/sh\nexit 1\n')
        result = self.call('recommendation_accept', {'id': item['id'], 'section': 'main'})
        self.assertFalse(result['success'])
        self.assertEqual(self.config.read_text(), self.original)
        self.assertEqual(self.call('recommendations')['data']['recommendations'][0]['status'], 'pending')


    def test_expiry_worker_removes_expired_configured_rule(self):
        rule = "config section 'nxt_old'\n\toption enabled '1'\n\toption action 'connection'\n\toption next_kind 'temporary'\n\toption next_target 'main'\n\toption next_expires '1'\n\tlist domain_suffix 'old.example'\n"
        self.config.write_text(self.original + rule)
        self.assertTrue(self.call('expire')['success'])
        self.assertNotIn('old.example', self.config.read_text())

    def test_smart_detect_enable_requires_explicit_probe_section(self):
        result=self.call('smart_detect_configure', {'enabled': True, 'section': 'main'})
        self.assertEqual(result.get('error'), 'section_probe_unavailable')
        self.assertEqual(self.config.read_text(), self.original)

    def test_smart_detect_configure_transaction_preserves_opt_in(self):
        self.original += "\toption mixed_proxy_enabled '1'\n\toption mixed_proxy_port '2080'\n"
        self.config.write_text(self.original)
        self.assertTrue(self.call('smart_detect_configure', {'enabled': True, 'section': 'main'})['success'])
        self.assertIn('smart_detect_enabled', self.config.read_text())
        self.assertIn('smart_detect_section', self.config.read_text())
        self.assertTrue(self.call('smart_detect_configure', {'enabled': False})['success'])
