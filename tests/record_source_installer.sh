#!/bin/sh
# Isolated native fixture: no service, package-manager or network invocation.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
extract() {
    awk -v wanted=" $2 " '
        /^function [A-Za-z_][A-Za-z_0-9]*\(/ {
            name=$2; sub(/\(.*/, "", name); emit=index(wanted," " name " ")>0
        }
        emit { print }
        /^}/ { emit=0 }
    ' "$1"
}
printf 'fixture archive, never executed\n' > "$WORK/payload"
digest=$(sha256sum "$WORK/payload" | awk '{print $1}')
cat > "$WORK/download.uc" <<'UCODE'
let fs=require('fs');let events=[];
function download_with_retry(url,path,label){push(events,'download');return fs.writefile(path,fs.readfile(ARGV[0]))!=null;}
UCODE
extract "$ROOT/forkop/files/usr/lib/components/action.uc" 'as_string shell_quote command_from_args command_output command_output_from_args remove_file sing_box_release_destination_valid download_verified_sing_box_extended' >> "$WORK/download.uc"
cat >> "$WORK/download.uc" <<'UCODE'
let name='sing-box-1.14.3-extended-2.7.3-forkop-record1-linux-arm64-compressed.tar.gz';
let tag='core-1.14.3-extended-2.7.3-forkop-record1';
let release={source:'forkop-next-record',tag,asset_name:name,sha256:ARGV[2],asset_url:'https://github.com/m0llusca/forkop-next/releases/download/'+tag+'/'+name};
let valid=download_verified_sing_box_extended(release,ARGV[1]);
if(!valid || length(events)!=1)die('FAIL: pinned custom archive source must be accepted before extraction');
print('PASS: custom archive destination and checksum\n');
release.sha256='0000000000000000000000000000000000000000000000000000000000000000';
if(download_verified_sing_box_extended(release,ARGV[1]) || fs.stat(ARGV[1])!=null)die('FAIL: corrupt archive retained');
release.sha256=ARGV[2];
for(let url in [replace(release.asset_url,'https:','http:'),release.asset_url+'?redirect=evil',replace(release.asset_url,'github.com/','github.com.evil.invalid/'),replace(release.asset_url,'/'+tag+'/','/other/')]){
    events=[];release.asset_url=url;
    if(download_verified_sing_box_extended(release,ARGV[1]) || length(events))die('FAIL: invalid destination performed download');
}
print('PASS: invalid destination rejected before download\n');
UCODE
ucode "$WORK/download.uc" "$WORK/payload" "$WORK/archive" "$digest"
mkdir -p "$WORK/lib/singbox"
cat > "$WORK/lib/singbox/validated-cores.json" <<JSON
{"schema":1,"cores":[{"version":"1.14.3-extended-2.7.3-forkop-record1","source":"forkop-next-record","source_current":true,"architecture":"arm64-compressed","release_tag":"core-1.14.3-extended-2.7.3-forkop-record1","asset":"sing-box-1.14.3-extended-2.7.3-forkop-record1-linux-arm64-compressed.tar.gz","archive_sha256":"$digest","sha256":"$digest","validation_memory_kb":140000,"reality_hybrid":true,"reality_record_fragment":true}]}
JSON
cat > "$WORK/resolve.uc" <<'UCODE'
let fs=require('fs');const LIB_DIR=ARGV[0];let architecture='arm64';
let reality=require('singbox.reality');
function resolve_sing_box_extended_arch_suffix(){return architecture;}
UCODE
extract "$ROOT/forkop/files/usr/lib/components/action.uc" 'as_string shell_quote command_from_args command_output command_output_from_args sing_box_release_destination_valid resolve_sing_box_record_release verify_sing_box_record_binary sing_box_verified_runtime' >> "$WORK/resolve.uc"
cat >> "$WORK/resolve.uc" <<'UCODE'
let release=resolve_sing_box_record_release();
if(!release || release.source!='forkop-next-record' || !sing_box_release_destination_valid(release))die('FAIL: manifest-pinned source resolution');
if(release.validation_memory_kb!=140000)die('FAIL: pinned validation memory requirement lost');
let manifest=json(fs.readfile(LIB_DIR+'/singbox/validated-cores.json'));
let history=json(sprintf('%J',manifest.cores[0]));history.source_current=false;history.version='1.14.3-extended-2.7.3-record-old';
push(manifest.cores,history);fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
if(resolve_sing_box_record_release()?.version!=release.version)die('FAIL: historical admission changed selected release');
manifest.cores[1]=json(sprintf('%J',manifest.cores[0]));fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
if(resolve_sing_box_record_release()!=null)die('FAIL: ambiguous current release accepted');
manifest.cores=[manifest.cores[0]];fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
for(let bad in [null,0,-1,140000.5,4194305,'140000','NaN',true]){
    manifest.cores[0].validation_memory_kb=bad;fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
    if(resolve_sing_box_record_release()!=null)die('FAIL: invalid memory requirement accepted by resolver');
}
manifest.cores[0].validation_memory_kb=140000;fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
if(!verify_sing_box_record_binary(release,ARGV[1]))die('FAIL: first-install exact executable identity must be admitted without execution');
fs.writefile(ARGV[1], 'corrupt candidate');
if(verify_sing_box_record_binary(release,ARGV[1]))die('FAIL: corrupt executable admitted');
architecture='mipsle';
if(resolve_sing_box_record_release()!=null)die('FAIL: unsupported architecture fell back');
architecture='arm64';
manifest=json(fs.readfile(LIB_DIR+'/singbox/validated-cores.json'));
manifest.cores[0].release_tag='other-tag';fs.writefile(LIB_DIR+'/singbox/validated-cores.json',sprintf('%J',manifest));
if(resolve_sing_box_record_release()!=null)die('FAIL: unbound core release tag accepted');
print('PASS: source manifest binding, first-install executable SHA and unsupported architecture\n');
UCODE
FORKOP_LIB="$WORK/lib" ucode -L "$ROOT/forkop/files/usr/lib" "$WORK/resolve.uc" "$WORK/lib" "$WORK/payload"

cat > "$WORK/runtime.uc" <<'UCODE'
let fs=require('fs');const SB_SOURCE_STATE_FILE=ARGV[0];
function as_string(value){return value==null?'':''+value;}
function file_first_line(path){return trim(fs.readfile(path)||'');}
function ensure_parent_dir(path){return true;}
function write_file(path,value){return fs.writefile(path,value)!=null;}
UCODE
extract "$ROOT/forkop/files/usr/lib/singbox/runtime.uc" 'sing_box_source_state sing_box_write_source_state' >> "$WORK/runtime.uc"
cat >> "$WORK/runtime.uc" <<'UCODE'
if(sing_box_source_state()!='')die('FAIL: missing source must default official');
if(sing_box_write_source_state('evil-source'))die('FAIL: arbitrary source accepted');
if(fs.stat(SB_SOURCE_STATE_FILE)!=null)die('FAIL: invalid source persisted');
if(!sing_box_write_source_state('forkop-next-record') || sing_box_source_state()!='forkop-next-record')die('FAIL: selected source did not persist');
if(!sing_box_write_source_state('') || fs.stat(SB_SOURCE_STATE_FILE)!=null)die('FAIL: absent source not restored');
print('PASS: source marker allowlist and absent state\n');
UCODE
ucode "$WORK/runtime.uc" "$WORK/source"

cat > "$WORK/cache.uc" <<'UCODE'
let fs=require('fs');const SB_SOURCE_STATE_FILE=ARGV[0],COMPONENT_UPDATE_CHECK_CACHE_DIR=ARGV[1];
function as_string(value){return value==null?'':''+value;}
function normalize_component_name(value){return value;}
function valid_component_name(value){return value=='sing_box'||value=='forkop';}
function object_or_empty(value){return type(value)=='object'?value:{};}
UCODE
extract "$ROOT/forkop/files/usr/lib/components/updates.uc" 'component_update_check_cache_path component_update_check_result_cacheable' >> "$WORK/cache.uc"
cat >> "$WORK/cache.uc" <<'UCODE'
let official=component_update_check_cache_path('sing_box');
fs.writefile(SB_SOURCE_STATE_FILE,'forkop-next-record\n');
let custom=component_update_check_cache_path('sing_box');
if(official==custom || index(custom,'forkop-next-record')<0)die('FAIL: component cache crossed source channels');
let stale={component:'sing_box',action:'check_update',success:true,status:'outdated'};
if(component_update_check_result_cacheable(stale))die('FAIL: in-flight official result accepted by custom cache');
stale.source='forkop-next-record';
if(!component_update_check_result_cacheable(stale))die('FAIL: matching source cache result rejected');
fs.writefile(SB_SOURCE_STATE_FILE,'../../arbitrary\n');
if(component_update_check_cache_path('sing_box')!='')die('FAIL: invalid source fell back to official cache');
print('PASS: component check cache source isolation\n');
UCODE
ucode "$WORK/cache.uc" "$WORK/source" "$WORK/cache"

mkdir "$WORK/bin"
cat > "$WORK/bin/apk" <<'SH'
#!/bin/sh
case "$FIXTURE_OWNER" in owned) printf 'fixture owns sing-box\n';exit 0;; unowned) exit 1;; failure) exit 2;; esac
SH
cp "$WORK/bin/apk" "$WORK/bin/opkg"
chmod 0755 "$WORK/bin/apk" "$WORK/bin/opkg"
cat > "$WORK/ownership.uc" <<'UCODE'
let fs=require('fs');
function file_exists(path){return ARGV[0]!='absent';}
function command_exists(name){return ARGV[0]!='no-manager' && name==ARGV[1];}
UCODE
extract "$ROOT/forkop/files/usr/lib/components/action.uc" 'as_string shell_quote command_from_args sing_box_binary_unowned' >> "$WORK/ownership.uc"
cat >> "$WORK/ownership.uc" <<'UCODE'
let expected=ARGV[0]=='unowned'||ARGV[0]=='absent';
if(sing_box_binary_unowned()!=expected)die('FAIL: binary ownership gate '+ARGV[0]);
print('PASS: binary ownership gate '+ARGV[0]+' '+ARGV[1]+'\n');
UCODE
for manager in apk opkg; do
    for ownership in owned unowned failure no-manager absent; do
        FIXTURE_OWNER="$ownership" PATH="$WORK/bin:$PATH" ucode "$WORK/ownership.uc" "$ownership" "$manager"
    done
done
