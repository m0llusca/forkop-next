"""Every backend package format must install the public CLI's timeout command."""
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class RuntimeTimeoutDependency(unittest.TestCase):
    def test_sdk_backend_requires_timeout_package(self):
        source = (ROOT / 'forkop/Makefile').read_text(encoding='utf-8')
        package = re.search(r'^define Package/forkop\n(.*?)^endef$', source, re.M | re.S)
        self.assertIsNotNone(package, 'backend SDK package definition must exist')
        declaration = re.search(r'^\s*DEPENDS:=(.*)$', package[1], re.M)
        self.assertIsNotNone(declaration, 'backend SDK dependencies must be declared')
        self.assertIn('+coreutils-timeout', declaration[1].split(),
                      'SDK backend must require the timeout executable used by its public CLI')

    def release_dependencies(self, variable):
        source = (ROOT / 'build.sh').read_text(encoding='utf-8')
        declaration = re.search(r'^' + re.escape(variable) + r'="([^"\n]*)"$', source, re.M)
        self.assertIsNotNone(declaration, variable + ' must be declared')
        return declaration[1]

    def test_release_ipk_requires_timeout_package(self):
        dependencies = [value.strip() for value in self.release_dependencies('BACKEND_DEPENDS_IPK').split(',')]
        self.assertIn('coreutils-timeout', dependencies,
                      'release IPK must require the timeout executable used by its public CLI')

    def test_release_apk_requires_timeout_package(self):
        dependencies = self.release_dependencies('BACKEND_DEPENDS_APK').split()
        self.assertIn('coreutils-timeout', dependencies,
                      'release APK must require the timeout executable used by its public CLI')


if __name__ == '__main__':
    unittest.main()
