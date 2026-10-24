#!/bin/sh
# Complete installer function, with all service/network/execution boundaries isolated.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
extract() {
    awk -v wanted=" $2 " '
        /^function [A-Za-z_][A-Za-z_0-9]*\(/ { name=$2;sub(/\(.*/,"",name);emit=index(wanted," " name " ")>0 }
        emit {print}
        /^}/ {emit=0}
    ' "$1"
}
mkdir "$WORK/asset"
printf 'inert candidate; execution boundary is stubbed\n' > "$WORK/asset/sing-box"
tar -czf "$WORK/asset.tar.gz" -C "$WORK/asset" sing-box
archive_sha=$(sha256sum "$WORK/asset.tar.gz" | awk '{print $1}')
binary_sha=$(sha256sum "$WORK/asset/sing-box" | awk '{print $1}')
cat > "$WORK/prelude.uc" <<'UCODE'
let fs=require('fs'),events=[],result=null;
const SERVICE_INIT=ARGV[0]+'/forkop-init';
let tmp_dir=ARGV[1],mode=ARGV[2],forkop_was_running=true,forkop_stopped_for_sing_box_change=false;
let constants={};let uci_core={get:function(path){return ARGV[0]+'/config.json';}};
let version='1.14.3-extended-2.7.3-forkop-record1',tag='core-'+version;
let release={source:'forkop-next-record',version,tag,validation_memory_kb:140000,asset_name:'sing-box-'+version+'-linux-arm64-compressed.tar.gz',sha256:ARGV[4],executable_sha256:mode=='bad-sha'?'0000000000000000000000000000000000000000000000000000000000000000':ARGV[5],asset_url:'https://github.com/m0llusca/forkop-next/releases/download/'+tag+'/sing-box-'+version+'-linux-arm64-compressed.tar.gz'};
function init_tmp_dir(){return true;}
function owner_pid(){return 'fixture';}
function updates_log(message,level){}
function resolve_sing_box_record_release(){return release;}
function sing_box_binary_unowned(){return mode!='owned';}
function sing_box_record_memory_sufficient(release){push(events,'memory');if(fs.stat(tmp_dir+'/'+release.asset_name)!=null)die('FAIL: verified archive retained at memory gate');return mode!='low-memory';}
function sing_box_runtime_output(action,args){return action=='version'?'old-extended':mode=='wrong-variant'?'stable':'extended-compressed';}
function sing_box_verified_runtime(v,path){return {source:'forkop-next-record',architecture:'arm64-compressed',reality_record_fragment:mode!='bad-cap'};}
function download_with_retry(url,path,label){push(events,'download');return fs.writefile(path,fs.readfile(ARGV[3]))!=null;}
function select_archive_member_path(archive,name){return 'sing-box';}
function validate_sing_box_extended_binary(path,lib){push(events,'execute');return mode=='bad-version'?'wrong-extended':version;}
function stop_forkop_before_sing_box_change(){push(events,'stop');forkop_stopped_for_sing_box_change=true;fs.writefile(ARGV[0]+'/config.json','generated mutation');fs.writefile(ARGV[0]+'/etc/config/sing-box','enabled=0');}
function install_managed_sing_box_service_script(){fs.writefile(ARGV[0]+'/etc/init.d/sing-box','new init');return true;}
function sing_box_runtime_success(action,args){
    let name=action=='write-variant-marker'?'sing-box-variant':action=='write-version-state'?'sing-box-version':'sing-box-source';
    fs.writefile(ARGV[0]+'/etc/forkop/'+name,args[0]+'\n');
    push(events,action);
    return !(mode=='source-fail' && action=='write-source-state');
}
function restart_forkop_after_successful_change(){push(events,'restart');}
function wait_forkop_running_after_sing_box_change(){push(events,'health');return mode!='health-fail' && mode!='first-health-fail';}
function clear_version_caches(){}
function action_fail(component,action,message){result={success:false,message};die('__fixture_done__');}
function action_success(component,action,message){result={success:true,message};die('__fixture_done__');}
function check_success(component,current,latest,url){die('unexpected check');}
UCODE
extract "$ROOT/forkop/files/usr/lib/components/action.uc" 'as_string shell_quote command_from_args command_status command_success command_success_from_args command_output command_output_from_args file_exists remove_file sing_box_release_destination_valid download_verified_sing_box_extended verify_sing_box_record_binary snapshot_sing_box_record_state restore_sing_box_record_state fail_sing_box_record_install install_staged_file install_sing_box_record_compressed' > "$WORK/functions.uc"
awk '{print; if ($0 ~ /^function install_staged_file\(/) print "    if(ARGV[2]==\"copy-fail\"){fs.writefile(target_path,\"partial failed install\");return false;}";}' "$WORK/functions.uc" > "$WORK/functions-injected.uc"
cat > "$WORK/assert.uc" <<'UCODE'
let paths=[ARGV[0]+'/usr/bin/sing-box',ARGV[0]+'/usr/lib/libcronet.so',ARGV[0]+'/config.json',ARGV[0]+'/etc/config/sing-box',ARGV[0]+'/etc/init.d/sing-box',ARGV[0]+'/etc/forkop/sing-box-variant',ARGV[0]+'/etc/forkop/sing-box-version',ARGV[0]+'/etc/forkop/sing-box-source'];
let before=[];
for(let path in paths)push(before,{path,data:fs.readfile(path),stat:fs.stat(path)});
try{install_sing_box_record_compressed('install_forkop_record_compressed');}catch(e){if(index(''+e,'__fixture_done__')<0){warn(sprintf('fixture mode=%s events=%J exception=%J\n',mode,events,e));die(e);}}
if(result==null)die('FAIL: missing install result');
let late=index(['copy-fail','health-fail','source-fail','first-health-fail'],mode)>=0;
if(mode=='success'){
    if(!result.success || fs.readfile(paths[0])!=fs.readfile(ARGV[6]) || trim(fs.readfile(paths[7])||'')!='forkop-next-record')die('FAIL: successful commit state');
    if(index(events,'health')>index(events,'write-source-state') || index(events,'write-source-state')<0)die('FAIL: source persisted before health');
}else{
    if(mode=='low-memory' && (index(events,'execute')>=0 || index(events,'stop')>=0))die('FAIL: insufficient-memory candidate executed or stopped service');
    if(mode=='low-memory' && index(result.message,'Insufficient memory')<0)die('FAIL: missing explicit insufficient memory error');
    if(result.success)die('FAIL: failing mode reported success');
    for(let state in before){
        let after=fs.stat(state.path);
        if(fs.readfile(state.path)!=state.data || (state.stat==null)!=(after==null) || (after && after.mode!=state.stat.mode))die('FAIL: exact prior state lost: '+mode+' '+state.path);
    }
    if(!late && index(events,'stop')>=0)die('FAIL: unverified candidate stopped service');
    if(index(['bad-sha','bad-cap','owned','wrong-variant'],mode)>=0 && index(events,'execute')>=0)die('FAIL: unverified candidate executed');
}
print('PASS: custom transaction '+mode+'\n');
UCODE
for mode in success bad-sha bad-cap owned wrong-variant bad-version copy-fail health-fail source-fail first-health-fail low-memory; do
    live="$WORK/$mode"
    mkdir -p "$live/usr/bin" "$live/usr/lib" "$live/etc/config" "$live/etc/init.d" "$live/etc/forkop" "$live/tmp"
    printf '#!/bin/sh\nexit 0\n' > "$live/forkop-init"
    chmod 0755 "$live/forkop-init"
    if [ "$mode" != first-health-fail ]; then
        for file in usr/bin/sing-box usr/lib/libcronet.so config.json etc/config/sing-box etc/init.d/sing-box etc/forkop/sing-box-variant etc/forkop/sing-box-version etc/forkop/sing-box-source; do
            printf 'original exact %s\n' "$file" > "$live/$file"
            chmod 0600 "$live/$file"
        done
    fi
    cat "$WORK/prelude.uc" "$WORK/functions-injected.uc" "$WORK/assert.uc" |
        sed "s|\"/usr/bin/sing-box\"|\"$live/usr/bin/sing-box\"|g;s|\"/usr/lib/libcronet.so\"|\"$live/usr/lib/libcronet.so\"|g;s|\"/etc/config/sing-box\"|\"$live/etc/config/sing-box\"|g;s|\"/etc/init.d/sing-box\"|\"$live/etc/init.d/sing-box\"|g;s|\"/etc/forkop/|\"$live/etc/forkop/|g" > "$WORK/run.uc"
    # State-file environment values must not point outside the fixture tree.
    SB_VARIANT_STATE_FILE="$live/etc/forkop/sing-box-variant" SB_VERSION_STATE_FILE="$live/etc/forkop/sing-box-version" SB_SOURCE_STATE_FILE="$live/etc/forkop/sing-box-source" \
        ucode "$WORK/run.uc" "$live" "$live/tmp" "$mode" "$WORK/asset.tar.gz" "$archive_sha" "$binary_sha" "$WORK/asset/sing-box"
done
