"""Behavior tests for real next CLI. Needs Linux ucode with fs + uci modules.
Breaks caught: lost config snapshots, unsafe name traversal, accepting invalid UCI,
non-atomic replacement, failure to restore after rejected service activation.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / 'forkop/files/usr/lib'
CLI = ROOT / 'forkop/files/usr/bin/forkop'

class NextProfiles(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.config = self.dir / 'forkop'
        self.original = "config settings 'settings'\n\toption dns_type 'udp'\n\tlist dns_server '1.1.1.1'\n\tlist bootstrap_dns_server '1.1.1.1'\n"
        self.config.write_text(self.original)
        self.hook = self.dir / 'activate'
        self.hook.write_text('#!/bin/sh\nexit 0\n')
        self.hook.chmod(0o700)
        self.env = dict(os.environ, FORKOP_LIB=str(LIB), FORKOP_CONFIG_FILE=str(self.config),
                        FORKOP_NEXT_DIR=str(self.dir / 'next'), FORKOP_NEXT_ACTIVATE=str(self.hook),
                        FORKOP_RUNTIME_STATE_DIR=str(self.dir / 'run'))

    def call(self, action, payload=None):
        result = subprocess.run([os.getenv('UCODE', 'ucode'), '-L', str(LIB), str(CLI),
                                 'next', action, json.dumps(payload or {})],
                                env=self.env, capture_output=True, text=True)
        try:
            return json.loads(result.stdout)
        except ValueError:
            self.fail('CLI must return JSON; got ' + result.stdout + result.stderr)

    def test_saved_profile_exports_exact_original_config(self):
        self.assertTrue(self.call('profile_save', {'name': 'Home'})['success'])
        self.config.write_text(self.original.replace('udp', 'dot'))
        self.assertEqual(self.call('profile_export', {'name': 'Home'})['data']['config'], self.original)

    def test_invalid_name_never_writes_outside_profiles(self):
        result = self.call('profile_save', {'name': '../escaped'})
        self.assertEqual(result['error'], 'invalid_name')
        self.assertFalse((self.dir / 'escaped').exists())

    def test_invalid_uci_import_is_rejected(self):
        self.assertEqual(self.call('profile_import', {'name': 'Bad', 'config': 'not valid UCI\n'})['error'], 'invalid_config')
        self.assertEqual(self.config.read_text(), self.original)

    def test_profile_diff_lists_changed_options_without_secret_values(self):
        self.call('profile_save', {'name': 'Home'})
        self.config.write_text(self.original.replace('udp', 'dot'))
        diff = self.call('profile_diff', {'name': 'Home'})['data']
        self.assertEqual(diff['changed'], ['settings.dns_type'])

    def test_profile_diff_identifies_exact_saved_profile_contents(self):
        import hashlib
        self.assertTrue(self.call('profile_save', {'name': 'Home'})['success'])
        reviewed = self.call('profile_diff', {'name': 'Home'})['data']
        original_digest = hashlib.sha256(self.original.encode()).hexdigest()
        self.assertEqual(reviewed.get('profile_digest'), original_digest)

    def test_replaced_profile_cannot_apply_against_reviewed_profile_digest(self):
        import hashlib
        self.assertTrue(self.call('profile_save', {'name': 'Home'})['success'])
        reviewed = self.call('profile_diff', {'name': 'Home'})['data']
        original_digest = hashlib.sha256(self.original.encode()).hexdigest()
        self.assertTrue(self.call('profile_import', {
            'name': 'Home', 'config': self.original.replace('udp', 'dot')
        })['success'])
        result = self.call('profile_apply', {
            'name': 'Home', 'expected': reviewed['current_digest'],
            'expected_profile': original_digest,
        })
        self.assertEqual(result.get('error'), 'profile_conflict')
        self.assertEqual(self.config.read_text(), self.original)

    def test_profile_diff_digest_identifies_reviewed_bytes_during_external_edit(self):
        import hashlib
        import shlex
        self.assertTrue(self.call('profile_import', {
            'name': 'Home', 'config': self.original.replace('udp', 'dot')
        })['success'])
        replacement = self.dir / 'external-edit'
        replacement.write_text(self.original.replace('udp', 'doh'))
        marker = self.dir / 'edited'
        bindir = self.dir / 'bin'
        bindir.mkdir()
        sync = bindir / 'sync'
        sync.write_text('#!/bin/sh\nif [ ! -f ' + shlex.quote(str(marker)) + ' ]; then\n'
                        'cp ' + shlex.quote(str(replacement)) + ' ' + shlex.quote(str(self.config)) + '\n'
                        'touch ' + shlex.quote(str(marker)) + '\nfi\nexit 0\n')
        sync.chmod(0o700)
        self.env['PATH'] = str(bindir) + ':' + self.env['PATH']
        reviewed = self.call('profile_diff', {'name': 'Home'})['data']
        self.assertEqual(self.config.read_text(), replacement.read_text())
        self.assertEqual(reviewed['changed'], ['settings.dns_type'])
        self.assertEqual(reviewed['current_digest'], hashlib.sha256(self.original.encode()).hexdigest())
        result = self.call('profile_apply', {
            'name': 'Home', 'expected': reviewed['current_digest'],
            'expected_profile': reviewed['profile_digest'],
        })
        self.assertEqual(result.get('error'), 'conflict')
        self.assertEqual(self.config.read_text(), replacement.read_text())

    def test_apply_then_rollback_restores_original(self):
        changed = self.original.replace('udp', 'dot')
        self.assertTrue(self.call('profile_import', {'name': 'Travel', 'config': changed})['success'])
        self.assertTrue(self.call('profile_apply', {'name': 'Travel'})['success'])
        self.assertEqual(self.config.read_text(), changed)
        self.assertTrue(self.call('rollback')['success'])
        self.assertEqual(self.config.read_text(), self.original)

    def edit_on_first_sync(self, replacement):
        import shlex
        source = self.dir / 'external-copy'
        source.write_text(replacement)
        marker = self.dir / 'external-edit-done'
        bindir = self.dir / 'sync-bin'
        bindir.mkdir()
        command = bindir / 'sync'
        command.write_text('#!/bin/sh\nif [ ! -f ' + shlex.quote(str(marker)) + ' ]; then\n'
                           'cp ' + shlex.quote(str(source)) + ' ' + shlex.quote(str(self.config)) + '\n'
                           'touch ' + shlex.quote(str(marker)) + '\nfi\nexit 0\n')
        command.chmod(0o700)
        self.env['PATH'] = str(bindir) + ':' + self.env['PATH']

    def replace_before_file_hash(self, target, replacement):
        import shlex
        import shutil
        actual_hash = shutil.which('sha256sum')
        source = self.dir / 'reviewed-copy'
        source.write_text(replacement)
        bindir = self.dir / 'hash-bin'
        bindir.mkdir()
        command = bindir / 'sha256sum'
        command.write_text('#!/bin/sh\nif [ "$1" = ' + shlex.quote(str(target)) + ' ]; then\n'
                           'cp ' + shlex.quote(str(source)) + ' ' + shlex.quote(str(target)) + '\nfi\n'
                           'exec ' + shlex.quote(actual_hash) + ' "$@"\n')
        command.chmod(0o700)
        self.env['PATH'] = str(bindir) + ':' + self.env['PATH']

    def test_profile_apply_checks_digest_of_bytes_to_be_applied(self):
        import hashlib
        self.assertTrue(self.call('profile_save', {'name': 'Home'})['success'])
        profile = self.dir / 'next/profiles/Home.uci'
        profile.write_text(self.original.replace('udp', 'dot'))
        self.replace_before_file_hash(profile, self.original)
        result = self.call('profile_apply', {'name': 'Home', 'expected_profile': hashlib.sha256(self.original.encode()).hexdigest()})
        self.assertEqual(result.get('error'), 'profile_conflict')
        self.assertEqual(self.config.read_text(), self.original)

    def test_device_change_rejects_external_edit_after_snapshot_read(self):
        replacement = self.original.replace('udp', 'doh')
        self.edit_on_first_sync(replacement)
        result = self.call('device_set', {'address': '192.0.2.10', 'section': 'direct'})
        self.assertEqual(result.get('error'), 'conflict')
        self.assertEqual(self.config.read_text(), replacement)

    def test_native_apply_rejects_external_edit_after_candidate_read(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.write_text(self.original.replace('udp', 'dot'))
        replacement = self.original.replace('udp', 'doh')
        self.edit_on_first_sync(replacement)
        result = self.call('native_apply')
        self.assertEqual(result.get('error'), 'conflict')
        self.assertEqual(self.config.read_text(), replacement)

    def test_invalid_native_candidate_does_not_restore_over_external_edit(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.write_text(self.original.replace('udp', 'madeup'))
        replacement = self.original.replace('udp', 'doh')
        self.edit_on_first_sync(replacement)
        result = self.call('native_apply')
        self.assertEqual(result.get('error'), 'conflict')
        self.assertEqual(self.config.read_text(), replacement)

    def test_recovery_hashes_exact_backup_bytes_before_restore(self):
        import hashlib
        directory = self.dir / 'next'
        directory.mkdir()
        backup = directory / 'original.uci'
        backup.write_text(self.original.replace('udp', 'dot'))
        (directory / 'journal.json').write_text(json.dumps({'schema': 1, 'digest': hashlib.sha256(self.original.encode()).hexdigest()}))
        self.replace_before_file_hash(backup, self.original)
        result = self.call('startup_recover')
        self.assertEqual(result.get('error'), 'invalid_recovery')
        self.assertEqual(self.config.read_text(), self.original)

    def test_activation_failure_restores_original_and_records_error(self):
        self.call('profile_import', {'name': 'Travel', 'config': self.original.replace('udp', 'dot')})
        self.hook.write_text('#!/bin/sh\nexit 1\n')
        result = self.call('profile_apply', {'name': 'Travel'})
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'activation_failed')
        self.assertEqual(self.config.read_text(), self.original)

    def test_semantically_invalid_config_is_rejected_before_activation(self):
        self.call('profile_import', {'name': 'Invalid', 'config': self.original.replace('udp', 'madeup')})
        result = self.call('profile_apply', {'name': 'Invalid'})
        self.assertFalse(result['success'])
        self.assertEqual(self.config.read_text(), self.original)

    def test_insufficient_storage_rejects_apply_before_replacing_config(self):
        self.call('profile_import', {'name': 'Travel', 'config': self.original.replace('udp', 'dot')})
        bindir = self.dir / 'bin'
        bindir.mkdir()
        command = bindir / 'df'
        command.write_text('#!/bin/sh\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted\\nfixture 100 100 0 100%% /\\n"\n')
        command.chmod(0o700)
        self.env['PATH'] = str(bindir) + ':' + self.env['PATH']
        result = self.call('profile_apply', {'name': 'Travel'})
        self.assertEqual(result.get('error'), 'insufficient_space')
        self.assertEqual(self.config.read_text(), self.original)

    def test_symlink_storage_is_rejected(self):
        outside = self.dir / 'outside'
        outside.mkdir()
        (self.dir / 'next').symlink_to(outside, target_is_directory=True)
        self.assertFalse(self.call('profile_save', {'name': 'Home'})['success'])
        self.assertEqual(list(outside.iterdir()), [])

    def test_invalid_policy_target_is_rejected(self):
        config = self.original + "config section 'nxt_bad'\n\toption enabled '1'\n\toption action 'connection'\n\toption next_target 'missing'\n\toption next_kind 'temporary'\n\tlist domain_suffix 'example.com'\n"
        result = self.call('profile_import', {'name': 'Broken', 'config': config})
        self.assertEqual(result['error'], 'invalid_config')
        self.assertEqual(self.config.read_text(), self.original)

    def test_startup_recovery_restores_backup_without_starting_service(self):
        import hashlib
        directory = self.dir / 'next'
        directory.mkdir(exist_ok=True)
        (directory / 'original.uci').write_text(self.original)
        (directory / 'journal.json').write_text(json.dumps({'schema': 1, 'digest': hashlib.sha256(self.original.encode()).hexdigest()}))
        self.config.write_text(self.original.replace('udp', 'dot'))
        self.hook.write_text('#!/bin/sh\nexit 1\n')
        self.assertTrue(self.call('startup_recover')['success'])
        self.assertEqual(self.config.read_text(), self.original)
        self.assertFalse((directory / 'journal.json').exists())

    def test_recovery_restores_journal_backup(self):
        import hashlib
        original = self.original
        directory = self.dir / 'next'
        directory.mkdir(exist_ok=True)
        (directory / 'original.uci').write_text(original)
        (directory / 'journal.json').write_text(json.dumps({'schema': 1, 'digest': hashlib.sha256(original.encode()).hexdigest()}))
        self.config.write_text(original.replace('udp', 'dot'))
        self.assertTrue(self.call('recover')['success'])
        self.assertEqual(self.config.read_text(), original)
        self.assertFalse((directory / 'journal.json').exists())

    def test_supervised_timer_runs_expiry_and_opt_in_recommendation_tick(self):
        bindir=self.dir/'bin';bindir.mkdir()
        sleeper=bindir/'sleep'
        sleeper.write_text('#!/bin/sh\nif [ -e "'+str(self.dir/'slept')+'" ]; then exit 1; fi\ntouch "'+str(self.dir/'slept')+'"\n')
        sleeper.chmod(0o700)
        worker=self.dir/'worker'
        worker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "'+str(self.dir/'calls')+'"\n')
        worker.chmod(0o700)
        self.env['PATH']=str(bindir)+':'+self.env['PATH']
        self.env['FORKOP_BIN']=str(worker)
        run=subprocess.run(['ucode','-L',str(LIB),str(CLI),'next','timer','{}'],env=self.env,capture_output=True,text=True,timeout=5)
        self.assertEqual(run.returncode,0,run.stderr)
        self.assertEqual((self.dir/'calls').read_text().splitlines(),['next expire {}','next recommendation_tick {}'])

    def test_status_reads_actual_installed_sing_box_version(self):
        bindir=self.dir/'bin';bindir.mkdir()
        binary=bindir/'sing-box';binary.write_text('#!/bin/sh\necho "sing-box version 1.14.3"\n');binary.chmod(0o700)
        self.env['PATH']=str(bindir)+':'+self.env['PATH']
        result=self.call('status')['data']
        self.assertEqual(result['versions']['sing_box'],'1.14.3')
        self.assertEqual(result['smart_detect'],{'enabled':False,'section':'','interval':60})

    def test_native_reload_rejects_invalid_saved_changes_and_restores_checkpoint(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.write_text(self.original.replace('udp','madeup'))
        result=self.call('native_apply')
        self.assertFalse(result['success'])
        self.assertEqual(self.config.read_text(),self.original)

    def test_native_reload_restores_missing_config_from_checkpoint(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.unlink()
        result = self.call('native_apply')
        self.assertEqual(result.get('error'), 'invalid_config')
        self.assertTrue(result.get('data', {}).get('restored'))
        self.assertEqual(self.config.read_text(), self.original)

    def test_native_reload_activation_failure_restores_last_good_config(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.write_text(self.original.replace('udp','dot'))
        self.hook.write_text('#!/bin/sh\nexit 1\n')
        result=self.call('native_apply')
        self.assertFalse(result['success'])
        self.assertEqual(self.config.read_text(),self.original)

    def test_native_reload_success_updates_checkpoint_and_previous_config(self):
        self.assertTrue(self.call('checkpoint')['success'])
        changed=self.original.replace('udp','dot')
        self.config.write_text(changed)
        self.assertTrue(self.call('native_apply')['success'])
        self.assertEqual((self.dir/'next'/'applied.uci').read_text(),changed)
        self.assertEqual((self.dir/'next'/'previous.uci').read_text(),self.original)

    def test_native_apply_crash_journal_validates_previous_backup_not_new_candidate(self):
        self.assertTrue(self.call('checkpoint')['success'])
        self.config.write_text(self.original.replace('udp','dot'))
        self.hook.write_text('#!/bin/sh\nexit 1\n')
        self.assertFalse(self.call('native_apply')['success'])
        self.assertTrue((self.dir/'next'/'journal.json').exists())
        self.assertTrue(self.call('startup_recover')['success'])
        self.assertEqual(self.config.read_text(),self.original)
        self.assertFalse((self.dir/'next'/'journal.json').exists())

    def test_stale_digest_rejects_apply(self):
        self.call('profile_save', {'name': 'Home'})
        result = self.call('profile_apply', {'name': 'Home', 'expected': '0' * 64})
        self.assertEqual(result['error'], 'conflict')
        self.assertEqual(self.config.read_text(), self.original)

if __name__ == '__main__':
    unittest.main()
