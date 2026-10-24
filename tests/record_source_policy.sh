#!/bin/sh
# Optional baseline source permits behavioral RED without changing the worktree.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ACTION=${FORKOP_ACTION_SOURCE_FILE:-$ROOT/forkop/files/usr/lib/components/action.uc}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
extract() {
    awk -v wanted=" $2 " '
        /^function [A-Za-z_][A-Za-z_0-9]*\(/ {name=$2;sub(/\(.*/,"",name);emit=index(wanted," " name " ")>0}
        emit {print}
        /^}/ {emit=0}
    ' "$1"
}
cat > "$WORK/dispatch.uc" <<'UCODE'
let result='',source=ARGV[0];
function sing_box_runtime_output(mode,args){return mode=='read-source-state'?source:'extended-compressed';}
function install_sing_box_record_compressed(action){result='custom:'+action;}
function install_sing_box_extended(action,compressed){result='official';}
function install_package_sing_box(action,tiny){result='package';}
function action_fail(component,action,message){result='refused';die('fixture');}
UCODE
extract "$ACTION" 'dispatch_sing_box' >> "$WORK/dispatch.uc"
cat >> "$WORK/dispatch.uc" <<'UCODE'
try{dispatch_sing_box(ARGV[1]);}catch(e){}
if(result!=ARGV[2])die('FAIL: source dispatch '+ARGV[1]+' wanted '+ARGV[2]+' got '+result);
print('PASS: source dispatch '+ARGV[1]+' '+source+'\n');
UCODE
failed=0
for action in check_update install install_forkop_record_compressed; do
    ucode "$WORK/dispatch.uc" forkop-next-record "$action" "custom:$action" || failed=1
done
ucode "$WORK/dispatch.uc" unknown-source install refused || failed=1
ucode "$WORK/dispatch.uc" '' install official || failed=1

cat > "$WORK/guard.uc" <<'UCODE'
let fs=require('fs'),events=[],tmp_dir=ARGV[0],reality=null;
function init_tmp_dir(){return true;}
function sing_box_runtime_output(mode,args){return mode=='variant'||mode=='read-variant-marker'?'extended-compressed':'old-extended';}
function sing_box_runtime_success(mode,args){return true;}
function normalize_sing_box_version(value){return value;}
function resolve_sing_box_extended_release(compressed){return {tag:'new-extended',asset_name:'fixture.tar.gz'};}
function sing_box_verified_runtime(version,path){return {reality_hybrid:true,reality_record_fragment:path=='/usr/bin/sing-box'};}
function download_verified_sing_box_extended(release,path){push(events,'download');return true;}
function select_archive_member_path(archive,name){return name=='sing-box'?'sing-box':'';}
function owner_pid(){return 'fixture';}
function command_success(command){return true;}
function command_success_from_args(args){return true;}
function file_nonempty(path){return true;}
function remove_file(path){}
function stop_forkop_before_sing_box_change(){push(events,'stop');die('fixture-stop');}
function run_logged(label,command){push(events,'package-change');die('fixture-package');}
function pkg_list_update_command(){return 'fixture-no-command';}
function installed_package_version(name){return 'old-extended';}
function available_package_version(name){return 'new-stable';}
function action_fail(component,action,message){die('fixture-refused:'+message);}
function updates_log(message,level){}
UCODE
extract "$ACTION" 'as_string shell_quote command_from_args install_sing_box_extended_package install_sing_box_extended install_package_sing_box' >> "$WORK/guard.uc"
cat >> "$WORK/guard.uc" <<'UCODE'
let message='';
try{
    if(ARGV[1]=='compressed')install_sing_box_extended('install_extended_compressed',true);
    else if(ARGV[1]=='extended-package')install_sing_box_extended_package('install_extended');
    else install_package_sing_box('install_'+ARGV[1],ARGV[1]=='tiny');
}catch(e){message=''+e;}
if(index(events,'stop')>=0 || index(events,'package-change')>=0 || index(message,'record fragmentation')<0)die('FAIL: record capability downgrade '+ARGV[1]+' reached mutation or lacked refusal: '+message);
print('PASS: record capability downgrade rejected before stop '+ARGV[1]+'\n');
UCODE
for mode in compressed extended-package stable tiny; do
    ucode "$WORK/guard.uc" "$WORK" "$mode" || failed=1
done
exit "$failed"
