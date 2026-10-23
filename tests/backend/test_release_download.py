"""Execute release helpers: corrupt SDKs must never be promoted or reused.

Real SHA256, filesystem, git and compiler are exercised. Only the external
download boundary is replaced with a deterministic transport fixture.
"""
import hashlib
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ReleaseDownloadTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.cache = self.directory / 'cache'
        self.cache.mkdir()
        self.bin = self.directory / 'bin'
        self.bin.mkdir()
        self.payload = self.directory / 'payload'
        self.payload.write_bytes(b'verified sdk fixture\n')
        self.digest = hashlib.sha256(self.payload.read_bytes()).hexdigest()
        curl = self.bin / 'curl'
        curl.write_text('#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n'
                        'if [ "$1" = --output ]; then shift; cp "$PAYLOAD" "$1"; exit 0; fi\n'
                        'shift\ndone\nexit 2\n')
        curl.chmod(0o755)
        self.env = dict(os.environ, SDK_CACHE_DIR=str(self.cache),
                        PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                        PAYLOAD=str(self.payload))

    def call(self, command, extra=None):
        # Evaluate actual definitions, without running the release entry point.
        source = (ROOT / 'build.sh').read_text().rsplit('main "$@"', 1)[0]
        script = self.directory / 'helpers.sh'
        script.write_text(source + '\n' + command)
        return subprocess.run(['bash', str(script), '1.1.0'],
                              env={**self.env, **(extra or {})}, capture_output=True,
                              text=True, timeout=30)

    def test_verified_download_is_promoted(self):
        result = self.call('download_sdk_archive https://fixture.invalid/sdk.tar.zst ' + self.digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()).read_bytes(), self.payload.read_bytes())
        self.assertFalse((self.cache / 'sdk.tar.zst.part').exists())

    def test_wrong_download_is_never_promoted(self):
        result = self.call('download_sdk_archive https://fixture.invalid/sdk.tar.zst ' + '0' * 64)
        self.assertNotEqual(result.returncode, 0, 'mismatching payload was accepted')
        self.assertFalse((self.cache / 'sdk.tar.zst').exists())
        self.assertFalse((self.cache / 'sdk.tar.zst.part').exists())

    def test_cached_archive_is_rechecked(self):
        (self.cache / 'sdk.tar.zst').write_bytes(b'tampered cache')
        result = self.call('download_sdk_archive https://fixture.invalid/sdk.tar.zst ' + self.digest)
        self.assertNotEqual(result.returncode, 0, 'unverified cached SDK was accepted')
        self.assertEqual(result.stdout, '')

    def test_missing_digest_fails_before_download(self):
        result = self.call('download_sdk_archive https://fixture.invalid/sdk.tar.zst')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.cache / 'sdk.tar.zst').exists())

    def test_translation_tool_is_built_from_requested_commit(self):
        # A moving branch's new tool must not replace the pinned source version.
        repository = self.directory / 'luci'
        repository.mkdir()
        sdk = self.directory / 'sdk'
        sdk.mkdir()
        (sdk / 'scripts').mkdir()
        update = sdk / 'scripts/feeds'
        update.write_text('#!/bin/sh\nexit 1\n')
        update.chmod(0o755)
        subprocess.run(['git', 'init', '-q', str(repository)], check=True)
        source = repository / 'modules/luci-base/src'
        source.mkdir(parents=True)
        (source / 'po2lmo.c').write_text('#include <stdio.h>\nint main(void){puts("pinned");return 0;}\n')
        (source / 'Makefile').write_text('po2lmo: po2lmo.c\n\t$(CC) -o $@ $<\n')
        def commit(message):
            subprocess.run(['git', '-C', str(repository), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(repository), '-c', 'user.name=Fixture',
                            '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message], check=True)
            return subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True).strip()
        pinned = commit('pinned translation tool')
        (source / 'po2lmo.c').write_text('#include <stdio.h>\nint main(void){puts("moving");return 0;}\n')
        commit('moving translation tool')
        interrupted = self.cache / ('luci-' + pinned)
        interrupted.mkdir()
        subprocess.run(['git', 'init', '-q', str(interrupted)], check=True)
        result = self.call('ensure_po2lmo ' + shlex.quote(str(self.directory / 'sdk')),
                           {'LUCI_SOURCE_URL': str(repository), 'LUCI_SOURCE_REV': pinned})
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = subprocess.check_output([result.stdout.strip()], text=True).strip()
        self.assertEqual(actual, 'pinned')


if __name__ == '__main__':
    unittest.main()
