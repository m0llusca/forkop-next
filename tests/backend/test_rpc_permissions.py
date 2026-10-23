"""Read-only LuCI roles must not receive root mutation executables."""
import fnmatch
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
ACL = ROOT / 'luci-app-forkop/root/usr/share/rpcd/acl.d/luci-app-forkop.json'


class RpcPermissions(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
