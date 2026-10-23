"""Exercise real installer functions with isolated process/filesystem boundaries.

Function extraction follows components_updater_job.sh. No fixture calls a router
service or package manager; checksums and local backup moves use real files.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
ACTION = ROOT / 'forkop/files/usr/lib/components/action.uc'
UPDATER = ROOT / 'forkop/files/usr/lib/components/updater.uc'
TAG = 'v1.14.3-extended-2.7.3'
NAME = 'sing-box-' + TAG.lstrip('v') + '-linux-amd64-compressed.tar.gz'
URL = 'https://github.com/shtorm-7/sing-box-extended/releases/download/' + TAG + '/' + NAME


def functions(*names):
    source = ACTION.read_text()
    definitions = {}
    for match in re.finditer(r'^function (\w+)\([^\n]*\) \{\n.*?^\}', source, re.M | re.S):
        definitions[match[1]] = match[0]
    return '\n'.join(definitions[name] for name in names if name in definitions)


class ExtendedUpdateSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.d = Path(self.tmp.name)
        self.payload = self.d / 'payload'
        self.payload.write_bytes(b'fixture archive that must never be executed\n')
        self.digest = hashlib.sha256(self.payload.read_bytes()).hexdigest()

    def run_code(self, code, *args):
        script = self.d / 'fixture.uc'
        script.write_text(code)
        result = subprocess.run(['ucode', str(script), *map(str, args)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def install(self, compressed=True, digest=None, url=URL):
        # Keep the complete real installation entry point. Boundaries record any
        # attempted extraction, service stop, execution or package mutation.
        release = dict(tag=TAG, asset_name=NAME, asset_url=url,
                       sha256=self.digest if digest is None else digest)
        prelude = '''let fs=require("fs"); let events=[];
let tmp_dir=ARGV[0]; let release=json(ARGV[1]);
function init_tmp_dir(){return true;}
function sing_box_runtime_output(mode,args){return "extended";}
function sing_box_runtime_success(mode,args){return true;}
function normalize_sing_box_version(value){return value;}
function resolve_sing_box_extended_release(compressed){return release;}
function action_fail(component,action,message){die(message);}
function download_with_retry(url,path,label){push(events,"download"); fs.writefile(path,fs.readfile(ARGV[2]));return true;}
function select_archive_member_path(archive,name){push(events,"extract");return "";}
function run_logged(label,command){push(events,"package-change");return false;}
function pkg_list_update_command(){return "false";}
function stop_forkop_before_sing_box_change(){push(events,"stop");}
function updates_log(message,level){}
'''
        code = prelude + functions('as_string', 'shell_quote', 'command_from_args',
            'command_status', 'command_success', 'command_success_from_args',
            'command_output', 'command_output_from_args', 'file_nonempty',
            'remove_file', 'download_verified_sing_box_extended',
            'install_sing_box_extended_package', 'install_sing_box_extended')
        code += '\nlet message=""; try { install_sing_box_extended("update", ' + ('true' if compressed else 'false') + '); } catch(e) { message=""+e; }\nprint(sprintf("%J",{events,message}));'
        return self.run_code(code, self.d, json.dumps(release), self.payload)

    def test_corrupt_extended_archive_is_rejected_before_extract_stop_or_execute(self):
        result = self.install(digest='0' * 64)
        self.assertEqual(result['events'], ['download'], result)
        self.assertIn('verif', result['message'].lower(), result)

    def test_missing_digest_rejects_both_extended_install_forms_before_download(self):
        for compressed in (True, False):
            with self.subTest(compressed=compressed):
                result = self.install(compressed=compressed, digest='')
                self.assertEqual(result['events'], [], result)
                self.assertIn('verif', result['message'].lower(), result)

    def test_unofficial_or_plain_http_destination_never_downloads(self):
        for url in (URL.replace('https:', 'http:'), URL.replace('github.com/', 'github.com.evil.invalid/'),
                    URL + '?redirect=evil', URL.replace(TAG + '/', 'other-tag/')):
            with self.subTest(url=url):
                result = self.install(url=url)
                self.assertEqual(result['events'], [], result)

    def test_correct_digest_allows_archive_processing(self):
        result = self.install()
        self.assertEqual(result['events'], ['download', 'extract'], result)

    def test_extended_rollback_prefers_exact_local_backup_to_latest_package(self):
        binary = self.d / 'sing-box'
        backup = self.d / 'sing-box.backup'
        binary.write_bytes(b'failed new Extended binary')
        backup.write_bytes(b'exact previously working Extended build')
        code = '''let fs=require("fs");let events=[];
function restore_sing_box_package_variant(variant){push(events,"resolve-and-install-latest");return true;}
function updates_log(message,level){}
function owner_pid(){return "fixture";}
'''
        code += functions('as_string', 'shell_quote', 'command_from_args',
                          'command_status', 'command_success', 'command_success_from_args',
                          'file_nonempty', 'remove_file', 'move_file_portable',
                          'restore_sing_box_backup', 'sing_box_variant_is_package_managed',
                          'restore_sing_box_install_backup').replace('"/usr/bin/sing-box"', 'ARGV[0]')
        code += '\nlet restored=restore_sing_box_install_backup("extended",ARGV[1]); print(sprintf("%J",{restored,events}));'
        result = self.run_code(code, binary, backup)
        self.assertTrue(result['restored'], result)
        self.assertEqual(result['events'], [], result)
        self.assertEqual(binary.read_bytes(), b'exact previously working Extended build')

    def test_official_release_selection_keeps_sha256(self):
        release = dict(tag_name=TAG, assets=[dict(name=NAME, browser_download_url=URL,
                                                digest='sha256:' + self.digest)])
        # Resolver uses the actual updater process to obtain both URL and digest.
        code = '''let fs=require("fs");
function resolve_sing_box_extended_arch_suffix(){return "amd64";}
function path_basename(path){let p=split(path,"/");return p[length(p)-1];}
function helper_output_input(input,mode,args){
let p=fs.popen("ucode '"+ARGV[0]+"' '"+mode+"' '"+join("' '",args)+"' <'"+ARGV[1]+"'","r");
let output=p.read("all");p.close();return output;}
'''
        code += functions('as_string', 'sing_box_extended_tag_is_stable',
                          'set_sing_box_extended_release_from_json')
        code += '\nprint(sprintf("%J",set_sing_box_extended_release_from_json(fs.readfile(ARGV[1]),true)));'
        manifest = self.d / 'release.json'
        manifest.write_text(json.dumps(release))
        result = self.run_code(code, UPDATER, manifest)
        self.assertEqual(result.get('sha256'), self.digest, result)

    def test_missing_exact_extended_backup_fails_without_installing_latest(self):
        code = '''let events=[];
function restore_sing_box_package_variant(variant){push(events,"latest-package");return true;}
function restore_sing_box_backup(path){return false;}
function updates_log(message,level){}
'''
        code += functions('as_string', 'sing_box_variant_is_package_managed',
                          'restore_sing_box_install_backup')
        code += '\nlet restored=restore_sing_box_install_backup("extended",""); print(sprintf("%J",{restored,events}));'
        result = self.run_code(code)
        self.assertFalse(result['restored'], result)
        self.assertEqual(result['events'], [], result)

    def test_library_restore_failure_is_not_reported_as_success(self):
        prelude = '''let events=[];
function remove_file(path){}
function restore_file_backup(path,backup){push(events,"library-restore-failed");return false;}
function restore_sing_box_install_backup(variant,path){return true;}
function restore_sing_box_variant_state(marker,version){}
function restore_sing_box_service_from_marker(marker){return true;}
function clear_version_caches(){}
'''
        code = prelude + functions('as_string', 'restore_sing_box_after_failed_extended_install')
        code += '\nlet restored=restore_sing_box_after_failed_extended_install("extended","binary.backup","lib.backup","extended","old","",true); print(sprintf("%J",{restored,events}));'
        result = self.run_code(code)
        self.assertFalse(result['restored'], result)


if __name__ == '__main__':
    unittest.main()
