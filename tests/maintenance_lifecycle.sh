#!/bin/sh
# Native lifecycle tests: runtime side effects are replaced by a closed fixture.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
export FORKOP_LIB="$ROOT/forkop/files/usr/lib"
export FORKOP_RUNTIME_STATE_DIR="$WORK/run"
export FORKOP_PACKAGE_UPGRADE_STATE="$WORK/upgrade"
export TMP_SING_BOX_FOLDER="$WORK/sing-box"
export TMP_RULESET_FOLDER="$TMP_SING_BOX_FOLDER/rulesets"
mkdir -p "$FORKOP_RUNTIME_STATE_DIR" "$TMP_RULESET_FOLDER" "$WORK/custom"
printf 'fakeip-default\n' > "$TMP_SING_BOX_FOLDER/cache.db"
printf 'fakeip-custom\n' > "$WORK/custom/cache.db"
printf 'obsolete-ruleset\n' > "$TMP_RULESET_FOLDER/obsolete.json"
sed '/^let mode = ARGV\[0\] || "";/,$d' "$FORKOP_LIB/service/lifecycle.uc" > "$WORK/lifecycle.uc"
cat "$ROOT/tests/helpers/maintenance_lifecycle.uc" >> "$WORK/lifecycle.uc"
failed=0
for scenario in stop maintenance-stop restart stop-failure restart-stop-failure start-failure unstable-start maintenance-start ordinary-start maintenance-start-failure maintenance-start-unstable; do
  if ! ucode -L "$FORKOP_LIB" "$WORK/lifecycle.uc" "$scenario"; then failed=1; fi
done
[ "$(cat "$TMP_SING_BOX_FOLDER/cache.db")" = fakeip-default ] || exit 1
[ "$(cat "$WORK/custom/cache.db")" = fakeip-custom ] || exit 1
if [ -e "$TMP_RULESET_FOLDER/obsolete.json" ]; then
  printf 'FAIL: runtime stop left obsolete ruleset files\n' >&2
  failed=1
fi
if ucode -L "$FORKOP_LIB" "$FORKOP_LIB/service/initd.uc" initd-should-restore-dnsmasq-on-start-fixture maintenance 0; then
  printf 'FAIL: maintenance start resets the DNS forwarder\n' >&2
  failed=1
fi
ucode -L "$FORKOP_LIB" "$FORKOP_LIB/service/initd.uc" initd-should-restore-dnsmasq-on-start-fixture '' 0 || exit 1
sed '/^let mode = ARGV\[0\] || "";/,$d' "$FORKOP_LIB/service/initd.uc" > "$WORK/initd.uc"
cat "$ROOT/tests/helpers/maintenance_initd.uc" >> "$WORK/initd.uc"
for scenario in maintenance ordinary missing start-failure stop-failure restart restart-failure restart-missing; do
  if ! ucode -L "$FORKOP_LIB" "$WORK/initd.uc" "$scenario"; then failed=1; fi
done
# Exercise the public CLI's arity and missing-module safety with an isolated lib.
mkdir -p "$WORK/cli/service" "$WORK/cli/dns"
printf "print(join('|', ARGV));\n" > "$WORK/cli/service/lifecycle.uc"
for action in start stop; do
  result=$(FORKOP_LIB="$WORK/cli" ucode "$ROOT/forkop/files/usr/bin/forkop" "$action" maintenance)
  if [ "$result" != "$action|maintenance" ]; then
    printf 'FAIL: CLI dropped maintenance reason for %s\n' "$action" >&2
    failed=1
  fi
done
rm "$WORK/cli/service/lifecycle.uc"
export FORKOP_FIXTURE_FAILSAFE="$WORK/loader-failsafe"
printf "require('fs').writefile(getenv('FORKOP_FIXTURE_FAILSAFE'),ARGV[0]);\n" > "$WORK/cli/dns/apply.uc"
if FORKOP_LIB="$WORK/cli" ucode "$ROOT/forkop/files/usr/bin/forkop" start maintenance >/dev/null 2>&1; then exit 1; fi
[ "$(cat "$FORKOP_FIXTURE_FAILSAFE")" = failsafe-restore ] || exit 1
printf 'this is deliberately invalid ucode\n' > "$WORK/cli/service/lifecycle.uc"
rm "$FORKOP_FIXTURE_FAILSAFE"
if FORKOP_LIB="$WORK/cli" ucode "$ROOT/forkop/files/usr/bin/forkop" start maintenance >/dev/null 2>&1; then exit 1; fi
if [ ! -s "$FORKOP_FIXTURE_FAILSAFE" ]; then
  printf 'FAIL: broken lifecycle loader stranded maintenance DNS\n' >&2
  failed=1
fi
exit "$failed"
