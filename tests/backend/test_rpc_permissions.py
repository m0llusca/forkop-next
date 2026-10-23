"""Read-only LuCI roles must not receive root mutation executables."""
import fnmatch
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
ACL = ROOT / 'luci-app-forkop/root/usr/share/rpcd/acl.d/luci-app-forkop.json'


class RpcPermissions(unittest.TestCase):
    def uci_permissions(self, role, package):
        # rpcd session.c: arrays use the enclosing ACL permission (read/write),
        # while table entries name explicit functions for each object.
        policy = json.loads(ACL.read_text(encoding='utf-8'))['luci-app-forkop']
        scope = policy[role].get('uci', {})
        if isinstance(scope, list):
            return {role} if any(fnmatch.fnmatchcase(package, pattern) for pattern in scope) else set()
        return {
            permission
            for pattern, permissions in scope.items()
            if fnmatch.fnmatchcase(package, pattern)
            for permission in permissions
        }

    def permissions(self, role, executable):
        policy = json.loads(ACL.read_text(encoding='utf-8'))['luci-app-forkop']
        return {
            permission
            for pattern, permissions in policy[role].get('file', {}).items()
            if fnmatch.fnmatchcase(executable, pattern)
            for permission in permissions
        }

    def test_read_only_role_cannot_execute_mutation_capable_commands(self):
        for executable in ('/usr/bin/forkop', '/etc/init.d/forkop'):
            with self.subTest(executable=executable):
                self.assertNotIn('exec', self.permissions('read', executable))

    def test_write_role_retains_configuration_and_service_controls(self):
        for executable in ('/usr/bin/forkop', '/etc/init.d/forkop'):
            with self.subTest(executable=executable):
                self.assertIn('exec', self.permissions('write', executable))

    def test_read_only_role_cannot_read_credential_bearing_uci(self):
        self.assertNotIn('read', self.uci_permissions('read', 'forkop'))

    def test_write_role_retains_both_uci_read_and_write(self):
        self.assertEqual(self.uci_permissions('write', 'forkop'), {'read', 'write'})

    def test_read_only_role_cannot_read_raw_proxy_credentials_from_cache(self):
        self.assertNotIn('read', self.permissions('read', '/var/run/forkop/section-cache/main.json'))

    def test_write_role_retains_raw_section_cache_reads(self):
        self.assertIn('read', self.permissions('write', '/var/run/forkop/section-cache/main.json'))


if __name__ == '__main__':
    unittest.main()
