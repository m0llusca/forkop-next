#!/bin/sh
# Pure memory admission tests. No candidate, service or real proc file is touched.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
cat > "$WORK/test.uc" <<'UCODE'
let fallback='MemAvailable: 140000 kB\n';
let fs={readfile:function(path){if(path!='/proc/meminfo')die('FAIL: unexpected memory source');return fallback;}};
function as_string(value){return value==null?'':''+value;}
UCODE
awk '
    /^function sing_box_record_memory_sufficient\(/ {emit=1}
    emit {print}
    /^}/ {emit=0}
' "$ROOT/forkop/files/usr/lib/components/action.uc" >> "$WORK/test.uc"
cat >> "$WORK/test.uc" <<'UCODE'
let release={validation_memory_kb:140000};
let cases=[
    ['MemAvailable: 140000 kB\n',true],
    ['MemTotal: 262144 kB\nMemAvailable:     178000 kB\nMemFree: 1000 kB\n',true],
    ['MemAvailable:\t140000\tkB\r\n',true],
    ['MemAvailable: 139999 kB\n',false],
    ['MemAvailable: 0 kB\n',false],
    ['',false],
    ['MemFree: 999999 kB\n',false],
    ['MemAvailable: -1 kB\n',false],
    ['MemAvailable: +140000 kB\n',false],
    ['MemAvailable: 140000.5 kB\n',false],
    ['MemAvailable: NaN kB\n',false],
    ['MemAvailable: Infinity kB\n',false],
    ['MemAvailable: 140000 MB\n',false],
    ['MemAvailable: 140000\n',false],
    ['MemAvailable: 140000 kB trailing\n',false],
    ['MemAvailable: 9999999999999999999999999 kB\n',false],
    ['MemAvailable: 2147483648 kB\n',false],
    ['MemAvailable: 140000 kB\nMemAvailable: 140000 kB\n',false],
    ['MemAvailable: 140000 kB\nMemAvailable: malformed\n',false]
];
for(let i=0;i<length(cases);i++){
    if(sing_box_record_memory_sufficient(release,cases[i][0])!=cases[i][1])die('FAIL: memory sample '+i);
}
if(!sing_box_record_memory_sufficient(release))die('FAIL: default proc memory source not read');
fallback=null;
if(sing_box_record_memory_sufficient(release))die('FAIL: unavailable proc source admitted');
for(let required in [null,0,-1,140000.5,4194305,'140000','NaN',true]){
    if(sing_box_record_memory_sufficient({validation_memory_kb:required},'MemAvailable: 999999 kB\n'))die('FAIL: invalid requirement admitted');
}
if(!sing_box_record_memory_sufficient({validation_memory_kb:1},'MemAvailable: 1 kB\n') ||
   !sing_box_record_memory_sufficient({validation_memory_kb:4194304},'MemAvailable: 4194304 kB\n'))die('FAIL: positive requirement boundaries');
print('PASS: memory gate 19 samples, proc-source failure, 8 invalid requirements and positive boundaries\n');
UCODE
ucode "$WORK/test.uc"
