#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ln -s "$ROOT/forkop/files/etc/init.d/forkop" "$WORK/forkop"
initscript="$WORK/forkop"
source "$ROOT/forkop/files/etc/init.d/forkop"
initd_ucode() { return 0; }
commands=()
procd_open_instance() { :; }
procd_close_instance() { :; }
procd_set_param() { [ "$1" != command ] || commands+=("$*"); }
start_service ""
[ "${#commands[@]}" = 1 ] || { echo 'FAIL: next expiry worker must be supervised'; exit 1; }
[[ "${commands[0]}" == *"forkop next timer"* ]] || { echo 'FAIL: wrong expiry worker'; exit 1; }
echo 'PASS: supervised next timer'
