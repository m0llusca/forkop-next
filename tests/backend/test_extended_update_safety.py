"""Exercise real installer functions with isolated process/filesystem boundaries.

Function extraction follows components_updater_job.sh. No fixture calls a router
service or package manager; checksums and local backup moves use real files.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
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
let reality={verified_runtime:function(version,path){return null;}};
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
            'remove_file', 'sing_box_verified_runtime', 'download_verified_sing_box_extended',
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

    def rollback_service(self, existing_service=True, install_failure=False, package=False,
                         previous_marker='extended'):
        binary = self.d / 'runtime/sing-box'
        binary.parent.mkdir()
        binary.write_bytes(b'failed new core')
        backup = self.d / 'previous-core'
        backup.write_bytes(b'exact previous Extended core')
        init = self.d / 'init.d/sing-box'
        init.parent.mkdir()
        if existing_service:
            init.write_text('#!/bin/sh\n# Forkop managed sing-box service for binary variants\nstart_service() { :; }\n')
            init.chmod(0o755)
        prelude = '''let fs=require("fs");
const SB_MANAGED_SERVICE_MARKER="Forkop managed sing-box service for binary variants";
function owner_pid(){return "fixture";}
function updates_log(message,level){}
function pkg_remove_sing_box_conflict(package){return true;}
function restore_sing_box_package_variant(variant){die("network rollback is forbidden");}
function restore_sing_box_variant_state(marker,version){}
function clear_version_caches(){}
function write_file(path,value){return ARGV[2]!="fail" && fs.writefile(path,value)!=null;}
'''
        code = prelude + functions('as_string', 'shell_quote', 'command_from_args',
            'command_status', 'command_success', 'command_success_from_args',
            'file_exists', 'file_nonempty', 'read_file', 'remove_file', 'move_file_portable',
            'restore_file_backup', 'restore_sing_box_backup',
            'managed_sing_box_service_installed', 'managed_sing_box_service_text',
            'install_managed_sing_box_service_script', 'remove_managed_sing_box_service_script',
            'restore_sing_box_service_from_marker', 'sing_box_variant_is_package_managed',
            'restore_sing_box_install_backup', 'restore_sing_box_after_failed_extended_install',
            'restore_sing_box_after_failed_extended_package_install')
        code = code.replace('/usr/bin/sing-box', str(binary)).replace('/etc/init.d/sing-box', str(init))
        helper = 'restore_sing_box_after_failed_extended_' + ('package_install' if package else 'install')
        code += '\nlet restored=' + helper + '("extended",ARGV[0],"",ARGV[3],"old","",false);print(sprintf("%J",{restored}));'
        result = self.run_code(code, backup, init, 'fail' if install_failure else 'ok', previous_marker)
        return result, binary, init

    def test_late_compressed_failure_restores_exact_extended_binary_and_usable_init(self):
        result, binary, init = self.rollback_service()
        self.assertTrue(result['restored'], result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertTrue(init.exists(), 'Rollback removed the only usable service script')
        self.assertTrue(os.access(init, os.X_OK), 'Restored service must remain executable')
        self.assertIn('start_service', init.read_text())

    def test_extended_rollback_reports_failed_service_recreation(self):
        for package in (False, True):
            with self.subTest(package=package):
                # Each invocation owns an independent runtime tree.
                with tempfile.TemporaryDirectory() as directory:
                    previous = self.d
                    self.d = Path(directory)
                    try:
                        result, binary, init = self.rollback_service(
                            existing_service=False, install_failure=True, package=package)
                    finally:
                        self.d = previous
                    self.assertFalse(result['restored'], result)
                    self.assertFalse(init.exists())

    def test_markerless_extended_rollback_preserves_usable_managed_service(self):
        # Upstream package installations are identified by their executable's
        # version and need not have a Forkop variant marker. A failed compressed
        # upgrade has already replaced their package init with the managed init.
        result, binary, init = self.rollback_service(previous_marker='')
        self.assertTrue(result['restored'], result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertTrue(init.exists(), 'Markerless Extended rollback removed the only usable init')
        self.assertTrue(os.access(init, os.X_OK))

    def test_markerless_extended_rollback_recreates_missing_service(self):
        result, binary, init = self.rollback_service(existing_service=False, previous_marker='')
        self.assertTrue(result['restored'], result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertTrue(init.exists())
        self.assertTrue(os.access(init, os.X_OK))

    def test_markerless_extended_rollback_reports_service_recreation_failure(self):
        result, binary, init = self.rollback_service(existing_service=False,
                                                    install_failure=True, previous_marker='')
        self.assertFalse(result['restored'], result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertFalse(init.exists())

    def profile_install(self, compressed=True, current_admitted=True, candidate_admitted=False):
        # Model different authentic release artifacts carrying the same displayed
        # version. Admission is about the candidate ELF, not a release label.
        binary = self.d / 'runtime/sing-box'
        binary.parent.mkdir()
        binary.write_bytes(b'old admitted ELF')
        candidate = b'new official ELF'
        archive = self.d / 'candidate.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            member = tarfile.TarInfo('sing-box')
            member.size = len(candidate)
            tar.addfile(member, io.BytesIO(candidate))
        release = dict(tag=TAG, asset_name=NAME, asset_url=URL, release_url='',
                       sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
        prelude = '''let fs=require("fs");let events=[];let tmp_dir=ARGV[0];
let release=json(ARGV[1]);let current_admitted=ARGV[3]=="true",candidate_admitted=ARGV[4]=="true";
const SERVICE_INIT=tmp_dir+"/missing-forkop-init";
let reality={verified_runtime:function(version,path){
 let content=fs.readfile(path);
 if(content=="old admitted ELF" && current_admitted)return {reality_hybrid:true};
 if(content=="new official ELF" && candidate_admitted)return {reality_hybrid:true};
 return null;
}};
function init_tmp_dir(){return true;}
function owner_pid(){return "fixture";}
function sing_box_runtime_output(mode,args){
 return mode=="version"?"1.14.3-extended-2.7.3":"extended";}
function sing_box_runtime_success(mode,args){return true;}
function normalize_sing_box_version(value){return replace(value,/^v/,"");}
function resolve_sing_box_extended_release(compressed){return release;}
function action_fail(component,action,message){die(message);}
function action_success(component,action,message){push(events,"success");die("fixture success");}
function updates_log(message,level){}
function download_with_retry(url,path,label){fs.writefile(path,fs.readfile(ARGV[2]));return true;}
function select_archive_member_path(archive,name){return name=="sing-box"?"sing-box":"";}
function stop_forkop_before_sing_box_change(){push(events,"stop");if(ARGV[5]=="compressed")die("fixture reached service stop");}
function prepare_sing_box_package_service_install(){}
function pkg_list_update_command(){return "update";}
function pkg_install_files_command(files){return "install";}
function run_logged(label,command){
 if(command=="install"){push(events,"package-install");fs.writefile(ARGV[6],"new official ELF");}
 return true;}
function run_logged_pkg_remove_sing_box_conflict(package,label){return true;}
function pkg_remove_sing_box_conflict(package){return true;}
function validate_sing_box_extended_binary(path,library){push(events,"execute-candidate");return "1.14.3-extended-2.7.3";}
function write_sing_box_variant_state(marker,version){}
function restore_sing_box_variant_state(marker,version){}
function restore_sing_box_service_from_marker(marker){return true;}
function restart_forkop_after_successful_change(){push(events,"start");}
function wait_forkop_running_after_sing_box_change(){return true;}
function clear_version_caches(){}
function restore_sing_box_package_variant(variant){die("fixture forbids network rollback");}
'''
        code = prelude + functions('as_string', 'shell_quote', 'command_from_args',
            'command_status', 'command_success', 'command_success_from_args',
            'command_output', 'command_output_from_args', 'read_file', 'file_exists',
            'file_nonempty', 'remove_file', 'move_file_portable', 'move_file_to_backup',
            'restore_file_backup', 'restore_sing_box_backup',
            'sing_box_variant_is_package_managed', 'restore_sing_box_install_backup',
            'restore_sing_box_after_failed_extended_package_install',
            'sing_box_verified_runtime', 'download_verified_sing_box_extended',
            'install_sing_box_extended_package', 'install_sing_box_extended')
        code = code.replace('/usr/bin/sing-box', str(binary))
        code += '\nlet message="";try{install_sing_box_extended("update",' + ('true' if compressed else 'false') + ');}catch(e){message=""+e;}print(sprintf("%J",{events,message}));'
        result = self.run_code(code, self.d, json.dumps(release), archive,
            str(current_admitted).lower(), str(candidate_admitted).lower(),
            'compressed' if compressed else 'package', binary)
        return result, binary

    def test_admitted_current_core_rejects_unadmitted_compressed_elf_before_stop(self):
        result, binary = self.profile_install()
        self.assertNotIn('stop', result['events'], result)
        self.assertEqual(binary.read_bytes(), b'old admitted ELF')
        self.assertIn('capabil', result['message'].lower(), result)

    def test_admitted_current_core_rolls_back_unadmitted_package_before_execution_or_start(self):
        result, binary = self.profile_install(compressed=False)
        self.assertNotIn('execute-candidate', result['events'], result)
        self.assertNotIn('start', result['events'], result)
        self.assertNotIn('success', result['events'], result)
        self.assertEqual(binary.read_bytes(), b'old admitted ELF')
        self.assertIn('capabil', result['message'].lower(), result)

    def test_admitted_candidate_and_legacy_current_retain_existing_install_behavior(self):
        for current_admitted, candidate_admitted in ((True, True), (False, False)):
            for compressed in (True, False):
                with self.subTest(current=current_admitted, candidate=candidate_admitted, compressed=compressed):
                    with tempfile.TemporaryDirectory() as directory:
                        previous = self.d
                        self.d = Path(directory)
                        try:
                            result, binary = self.profile_install(compressed=compressed,
                                current_admitted=current_admitted, candidate_admitted=candidate_admitted)
                        finally:
                            self.d = previous
                        self.assertIn('stop', result['events'], result)
                        if not compressed:
                            self.assertIn('success', result['events'], result)

    def backup_failure_install(self, compressed, variant, failed_target,
                               include_candidate_library=True):
        """Run the entry point through backup failure with real local restores.

        Only downloads, package-manager calls, runtime inspection and candidate
        execution are boundaries. Service script creation/removal and all restore
        helpers run their production implementations against the fixture tree.
        """
        binary = self.d / 'runtime/sing-box'
        binary.parent.mkdir()
        previous_core = b'exact previous stable core' if variant == 'stable' else b'exact previous Extended core'
        binary.write_bytes(previous_core)
        library = self.d / 'runtime/libcronet.so'
        library.write_bytes(b'exact previous cronet library')
        init = self.d / 'init.d/sing-box'
        init.parent.mkdir()
        service_comment = ('upstream package service' if variant == 'stable' else
                           'Forkop managed sing-box service for binary variants')
        init.write_text('#!/bin/sh\n# ' + service_comment + '\nexit 0\n')
        init.chmod(0o755)
        archive = self.d / 'candidate.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, content in [('sing-box', b'candidate core'),
                                  ('libcronet.so', b'candidate cronet')]:
                if name == 'libcronet.so' and not include_candidate_library:
                    continue
                member = tarfile.TarInfo(name)
                member.size = len(content)
                tar.addfile(member, io.BytesIO(content))
        release = dict(tag=TAG, asset_name=NAME, asset_url=URL, release_url='',
                       sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
        prelude = '''let fs=require("fs");let events=[];
let tmp_dir=ARGV[0];let release=json(ARGV[1]);let reality={verified_runtime:function(version,path){return null;}};
const SB_MANAGED_SERVICE_MARKER="Forkop managed sing-box service for binary variants";
const SERVICE_INIT=tmp_dir+"/missing-forkop-init";
const BIN_PATH=tmp_dir+"/missing-forkop-bin";
let forkop_was_running=false;let forkop_stopped_for_sing_box_change=false;
let uci_core={available:function(){return false;}};
function init_tmp_dir(){return true;}
function owner_pid(){return "fixture";}
function updates_log(message,level){}
function sing_box_runtime_output(mode,args){
 if(mode=="variant")return ARGV[4];
 if(mode=="read-variant-marker")return ARGV[4];
 return ARGV[4]=="stable"?"1.13.0":"1.14.3-extended-2.7.3";}
function sing_box_runtime_success(mode,args){return true;}
function normalize_sing_box_version(value){return replace(value,/^v/,"");}
function resolve_sing_box_extended_release(compressed){return release;}
function download_with_retry(url,path,label){return fs.writefile(path,fs.readfile(ARGV[2]))!=null;}
function select_archive_member_path(archive,name){return name=="libcronet.so" && ARGV[6]=="false"?"":name;}
function validate_sing_box_extended_binary(path,library){return "1.14.3-extended-2.7.3";}
function pkg_list_update_command(){return "update";}
function pkg_install_files_command(files){return "install";}
function run_logged(label,command){push(events,command);return true;}
function pkg_remove_sing_box_conflict(package){
 push(events,"remove-"+package);
 // A missing-library fixture must stop before installation if production
 // incorrectly skips the original library backup.
 return ARGV[6]!="false";}
function run_logged_pkg_remove_sing_box_conflict(package,label){return pkg_remove_sing_box_conflict(package);}
function restore_sing_box_package_variant(variant){push(events,"restore-package-"+variant);return false;}
function restore_sing_box_variant_state(marker,version){}
function clear_version_caches(){}
function action_fail(component,action,message){
 push(events,fs.stat(ARGV[5])!=null?"restart-with-init":"restart-without-init");die(message);}
function action_success(component,action,message){die("unexpected install success");}
'''
        implementation = functions('as_string', 'shell_quote', 'command_from_args',
            'command_status', 'command_success', 'command_success_from_args',
            'command_output', 'command_output_from_args', 'file_exists', 'file_nonempty',
            'read_file', 'write_file', 'remove_file', 'move_file_portable',
            'move_file_to_backup', 'restore_file_backup', 'restore_sing_box_backup',
            'managed_sing_box_service_installed', 'managed_sing_box_service_text',
            'install_managed_sing_box_service_script', 'remove_managed_sing_box_service_script',
            'disable_sing_box_service_config', 'prepare_sing_box_service_disabled',
            'stop_forkop_before_sing_box_change',
            'prepare_sing_box_package_service_install', 'restore_sing_box_service_from_marker',
            'sing_box_variant_is_package_managed', 'restore_sing_box_install_backup',
            'restore_sing_box_after_failed_extended_install',
            'restore_sing_box_after_failed_extended_package_install',
            'sing_box_verified_runtime', 'download_verified_sing_box_extended',
            'install_sing_box_extended_package', 'install_sing_box_extended')
        implementation = implementation.replace(
            'function move_file_to_backup(target_path, backup_path) {',
            'function move_file_to_backup(target_path, backup_path) {\n'
            '    if (target_path == ARGV[3]) { push(events,"injected-backup-failure"); return false; }')
        code = (prelude + implementation).replace('/usr/bin/sing-box', str(binary))
        code = code.replace('/usr/lib/libcronet.so', str(library)).replace('/etc/init.d/sing-box', str(init))
        code += '\nlet message="",error_detail="";try{install_sing_box_extended("update",' + ('true' if compressed else 'false') + ');}catch(e){message=""+e;error_detail=sprintf("%J",e);}print(sprintf("%J",{events,message,error_detail}));'
        result = self.run_code(code, self.d, json.dumps(release), archive,
                               library if failed_target == 'library' else binary, variant, init,
                               str(include_candidate_library).lower())
        return result, binary, library, init

    def test_cronet_backup_failure_preserves_original_library_and_core(self):
        for compressed, variant in ((True, 'extended'), (False, 'extended'),
                                    (False, 'stable')):
            with self.subTest(compressed=compressed, variant=variant):
                with tempfile.TemporaryDirectory() as directory:
                    previous = self.d
                    self.d = Path(directory)
                    try:
                        result, binary, library, init = self.backup_failure_install(
                            compressed, variant, 'library')
                        self.assertIn('injected-backup-failure', result['events'], result)
                        self.assertIn('backup', result['message'].lower(), result)
                        self.assertFalse(any(event.startswith(('remove-', 'restore-package-')) or event == 'install'
                                             for event in result['events']), result)
                        previous_core = b'exact previous stable core' if variant == 'stable' else b'exact previous Extended core'
                        self.assertEqual(binary.read_bytes(), previous_core)
                        self.assertTrue(library.exists(), 'Failed backup deleted the original libcronet.so')
                        self.assertEqual(library.read_bytes(), b'exact previous cronet library')
                        self.assertTrue(init.exists(), 'Rollback must restore a usable service')
                    finally:
                        self.d = previous

    def test_package_binary_backup_failure_restores_service_before_restart(self):
        result, binary, library, init = self.backup_failure_install(False, 'extended', 'binary')
        self.assertIn('injected-backup-failure', result['events'], result)
        self.assertIn('backup', result['message'].lower(), result)
        self.assertFalse(any(event.startswith(('remove-', 'restore-package-')) or event == 'install'
                             for event in result['events']), result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertEqual(library.read_bytes(), b'exact previous cronet library')
        self.assertIn('restart-with-init', result['events'], result)
        self.assertNotIn('restart-without-init', result['events'], result)
        self.assertTrue(init.exists())
        self.assertTrue(os.access(init, os.X_OK))

    def test_compressed_archive_without_cronet_still_backs_up_existing_library_before_package_mutation(self):
        result, binary, library, init = self.backup_failure_install(
            True, 'extended', 'library', include_candidate_library=False)
        self.assertIn('injected-backup-failure', result['events'], result)
        self.assertIn('backup', result['message'].lower(), result)
        self.assertNotIn('unexpected install success', result['message'], result)
        self.assertFalse(any(event.startswith(('remove-', 'restore-package-')) or event == 'install'
                             for event in result['events']), result)
        self.assertEqual(binary.read_bytes(), b'exact previous Extended core')
        self.assertEqual(library.read_bytes(), b'exact previous cronet library')
        self.assertTrue(init.exists())
        self.assertTrue(os.access(init, os.X_OK))


if __name__ == '__main__':
    unittest.main()
