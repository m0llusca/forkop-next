#!/bin/sh
# Rejected Apply must not detach a healthy runtime from its DNS forwarder.
# Runs the shipped CLI, lifecycle functions, validator, Next lock and DNS apply.
# Only external service/hardware boundaries are replaced; all writes are temporary.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
SOURCE_LIB="$ROOT/forkop/files/usr/lib"
CLI="$ROOT/forkop/files/usr/bin/forkop"
export FORKOP_LIB="$WORK/lib"
export FORKOP_CONFIG_FILE="$WORK/forkop.uci"
export FORKOP_UCI_STATE_FILE="$WORK/uci.state"
export FORKOP_UCI_LOG_FILE="$WORK/uci.log"
export FORKOP_RUNTIME_STATE_DIR="$WORK/run"
export FORKOP_INTERNAL_CONFIG_TRIGGER_GUARD="$WORK/internal-config-change"
export FORKOP_NEXT_DIR="$WORK/next"
export FORKOP_RELOAD_LOCK_DIR="$WORK/reload.lock"
export FORKOP_PACKAGE_UPGRADE_STATE="$WORK/upgrade"
export TMP_SING_BOX_FOLDER="$WORK/sing-box"
export TMP_RULESET_FOLDER="$WORK/sing-box/rulesets"
export TMP_SUBSCRIPTION_FOLDER="$WORK/sing-box/subscriptions"
export FORKOP_CLI_DNS_RUNTIME="$WORK/core-running"
export FORKOP_CLI_DNS_NEXT_RESULT="$WORK/next-result.json"
export FORKOP_CLI_DNS_EVENTS="$WORK/events"
export FORKOP_CLI_DNS_READY="$WORK/dns-ready"
export FORKOP_UI_ACTION_TRACKED=1
export FORKOP_CONFIG_NAME=forkop
export DNSMASQ_INIT="$WORK/dnsmasq-init"
mkdir -p "$WORK/bin" "$FORKOP_RUNTIME_STATE_DIR" "$FORKOP_NEXT_DIR/profiles" \
  "$TMP_RULESET_FOLDER" "$TMP_SUBSCRIPTION_FOLDER"
cp -R "$SOURCE_LIB" "$FORKOP_LIB"
# Keep production functions AND their original dispatcher. Inject closed external
# boundaries between them so normal-return acknowledgements stay production code.
cp "$SOURCE_LIB/service/lifecycle.uc" "$WORK/lifecycle-source.uc"
sed '/^let mode = ARGV\[0\] || "";/,$d' "$WORK/lifecycle-source.uc" > "$WORK/lifecycle-functions.uc"
sed -n '/^let mode = ARGV\[0\] || "";/,$p' "$WORK/lifecycle-source.uc" > "$WORK/lifecycle-dispatcher.uc"
cat "$WORK/lifecycle-functions.uc" "$ROOT/tests/helpers/cli_reload_dns_preservation.uc" \
  "$WORK/lifecycle-dispatcher.uc" > "$WORK/lifecycle-driver.uc"
cat > "$WORK/bin/logger" <<'SH'
#!/bin/sh
exit 0
SH
cat > "$DNSMASQ_INIT" <<'SH'
#!/bin/sh
[ "$#" = 1 ] && [ "$1" = restart ] || exit 90
printf 'dnsmasq-restart\n' >> "$FORKOP_CLI_DNS_EVENTS"
if [ "$FORKOP_CLI_DNS_SCENARIO" = cleanup-retry ]; then
  attempt=$(grep -c '^dnsmasq-restart$' "$FORKOP_CLI_DNS_EVENTS")
  [ "$attempt" != 1 ] || exit 19
fi
printf 'ready\n' > "$FORKOP_CLI_DNS_READY"
SH
chmod 0755 "$WORK/bin/logger" "$DNSMASQ_INIT"
export PATH="$WORK/bin:$PATH"
failed=0
diagnosed=0
fail() {
  printf 'FAIL: %s\n' "$1" >&2
  if [ "$diagnosed" = 0 ]; then
    [ ! -f "$WORK/stderr" ] || head -n 12 "$WORK/stderr" >&2
    [ ! -f "$WORK/stdout" ] || head -n 8 "$WORK/stdout" >&2
    diagnosed=1
  fi
  failed=1
}

reset_fixture() {
  cp "$WORK/lifecycle-driver.uc" "$FORKOP_LIB/service/lifecycle.uc"
  cp "$SOURCE_LIB/service/next.uc" "$FORKOP_LIB/service/next.uc"
  rm -f "$FORKOP_NEXT_DIR/applied.uci" "$FORKOP_CLI_DNS_NEXT_RESULT" "$FORKOP_CLI_DNS_READY"
  cat > "$FORKOP_UCI_STATE_FILE" <<'STATE'
forkop.settings=settings
forkop.settings.shutdown_correctly=0
forkop.settings.dont_touch_dhcp=0
forkop.settings.dns_type=udp
forkop.settings.dns_strategy=invalid-for-regression
forkop.settings.dns_server=192.0.2.53
forkop.settings.bootstrap_dns_server=192.0.2.53
dhcp.@dnsmasq[0].server=127.0.0.42
dhcp.@dnsmasq[0].noresolv=1
dhcp.@dnsmasq[0].cachesize=0
dhcp.@dnsmasq[0].forkop_server=192.0.2.53
dhcp.@dnsmasq[0].forkop_noresolv=0
dhcp.@dnsmasq[0].forkop_cachesize=1000
STATE
  cat > "$FORKOP_CONFIG_FILE" <<'UCI'
config settings 'settings'
        option dns_type 'udp'
        option dns_strategy 'prefer_ipv4'
config section 'main'
        option action 'connection'
        list domain 'chosen.example'
        list subscription_url 'https://subscription.invalid/fixture'
UCI
  printf '{"outbounds":[]}\n' > "$TMP_SUBSCRIPTION_FOLDER/main-subscription-1.json"
  printf 'fakeip-cache-must-survive\n' > "$TMP_SING_BOX_FOLDER/cache.db"
  printf 'running\n' > "$FORKOP_CLI_DNS_RUNTIME"
  : > "$FORKOP_CLI_DNS_EVENTS"
  : > "$FORKOP_UCI_LOG_FILE"
  cp "$FORKOP_UCI_STATE_FILE" "$WORK/state.before"
  cp "$FORKOP_CONFIG_FILE" "$WORK/config.before"
  cp "$TMP_SUBSCRIPTION_FOLDER/main-subscription-1.json" "$WORK/subscription.before"
  cp "$TMP_SING_BOX_FOLDER/cache.db" "$WORK/fakeip.before"
}

run_cli() {
  diagnosed=0
  status=0
  ucode "$CLI" "$1" on_config_change > "$WORK/stdout" 2> "$WORK/stderr" || status=$?
}

assert_sources_unchanged() {
  cmp -s "$WORK/config.before" "$FORKOP_CONFIG_FILE" || fail "$scenario changed Main/source configuration"
  cmp -s "$WORK/subscription.before" "$TMP_SUBSCRIPTION_FOLDER/main-subscription-1.json" || fail "$scenario changed the subscription cache"
  cmp -s "$WORK/fakeip.before" "$TMP_SING_BOX_FOLDER/cache.db" || fail "$scenario changed the FakeIP cache"
}

assert_rejection_preserved_runtime() {
  [ "$status" = 1 ] || fail "$scenario lost its original nonzero status (got $status)"
  assert_sources_unchanged
  [ -f "$FORKOP_CLI_DNS_RUNTIME" ] || fail "$scenario stopped the existing core"
  cmp -s "$WORK/state.before" "$FORKOP_UCI_STATE_FILE" || fail "$scenario changed managed DNS/UCI after rejecting Apply before runtime mutation"
  grep -Fxq 'dhcp.@dnsmasq[0].server=127.0.0.42' "$FORKOP_UCI_STATE_FILE" || fail "$scenario detached DNS forwarding from the healthy core"
  [ ! -s "$FORKOP_UCI_LOG_FILE" ] || fail "$scenario committed configuration after rejecting Apply"
  [ ! -s "$FORKOP_CLI_DNS_EVENTS" ] || fail "$scenario restarted dnsmasq or stopped the core after rejecting Apply"
}

for scenario in validation next-busy next-no-checkpoint; do
  export FORKOP_CLI_DNS_SCENARIO="$scenario"
  reset_fixture
  if [ "$scenario" = validation ]; then rm "$FORKOP_LIB/service/next.uc"; fi
  run_cli reload
  case "$scenario" in
    validation)
      grep -Fq "Unsupported DNS strategy 'invalid-for-regression'" "$WORK/stdout" || fail 'validation did not reach the actual runtime validator'
      ;;
    next-busy|next-no-checkpoint)
      expected=busy
      [ "$scenario" != next-no-checkpoint ] || expected=no_checkpoint
      if ! ucode -e 'let fs=require("fs"); let value=json(fs.readfile(ARGV[0])); exit(value.success===false && value.error==ARGV[1] ? 0 : 1);' "$FORKOP_CLI_DNS_NEXT_RESULT" "$expected"; then
        fail "$scenario did not reach the actual Next preflight rejection"
      fi
      ;;
  esac
  assert_rejection_preserved_runtime
done

# Negative controls cover start AND reload: a readable but broken lifecycle must
# not be mistaken for a handled validation rejection. No working core is assumed.
for action in start reload; do
  for loader in missing broken; do
    scenario="$action-$loader-loader"
    export FORKOP_CLI_DNS_SCENARIO="$scenario"
    reset_fixture
    rm "$FORKOP_CLI_DNS_RUNTIME"
    if [ "$loader" = missing ]; then
      rm "$FORKOP_LIB/service/lifecycle.uc"
    else
      printf 'this is deliberately invalid ucode\n' > "$FORKOP_LIB/service/lifecycle.uc"
    fi
    run_cli "$action"
    [ "$status" != 0 ] || fail "$scenario reported success"
    grep -Fxq 'dhcp.@dnsmasq[0].server=192.0.2.53' "$FORKOP_UCI_STATE_FILE" || fail "$scenario failed to restore the original DNS resolver"
    grep -Fxq 'dnsmasq-restart' "$FORKOP_CLI_DNS_EVENTS" || fail "$scenario skipped real DNS apply recovery"
    assert_sources_unchanged
  done
done

# Keep the production cleanup contract once runtime mutation really has begun.
scenario=mutated-failure
export FORKOP_CLI_DNS_SCENARIO="$scenario"
reset_fixture
run_cli reload
[ "$status" = 37 ] || fail "mutated failure lost its original status 37 (got $status)"
[ ! -e "$FORKOP_CLI_DNS_RUNTIME" ] || fail 'mutated failure left the partial core running'
grep -Fxq 'dhcp.@dnsmasq[0].server=192.0.2.53' "$FORKOP_UCI_STATE_FILE" || fail 'mutated failure did not restore original DNS'
grep -Fxq 'forkop.settings.shutdown_correctly=1' "$FORKOP_UCI_STATE_FILE" || fail 'mutated failure did not mark clean shutdown'
assert_sources_unchanged

# Keep the legacy outer retry after runtime cleanup. The first real DNS apply
# changes the stored resolver but its external service restart fails. A second
# attempt must bring the forwarder up without replacing the reload's status.
scenario=cleanup-retry
export FORKOP_CLI_DNS_SCENARIO="$scenario"
reset_fixture
run_cli reload
[ "$status" = 37 ] || fail "cleanup retry lost its original status 37 (got $status)"
[ ! -e "$FORKOP_CLI_DNS_RUNTIME" ] || fail 'cleanup retry left the partial core running'
restarts=$(grep -c '^dnsmasq-restart$' "$FORKOP_CLI_DNS_EVENTS" || true)
[ "$restarts" = 2 ] || fail "runtime cleanup suppressed the legacy outer DNS retry (got $restarts restart attempts)"
[ -f "$FORKOP_CLI_DNS_READY" ] || fail 'cleanup retry left the DNS forwarder unavailable after the failed first restart'
grep -Fxq 'dhcp.@dnsmasq[0].server=192.0.2.53' "$FORKOP_UCI_STATE_FILE" || fail 'cleanup retry did not retain the original DNS resolver'
assert_sources_unchanged

# A completion file alone proves nothing: its exact status must match the child.
# The injected failure writes through the production acknowledgement function;
# exclusive creation prevents the normal dispatcher replacing that stale result.
scenario=mismatched-ack
export FORKOP_CLI_DNS_SCENARIO="$scenario"
reset_fixture
run_cli reload
[ "$status" = 1 ] || fail "mismatched acknowledgement replaced original status 1 (got $status)"
grep -Fxq 'dhcp.@dnsmasq[0].server=192.0.2.53' "$FORKOP_UCI_STATE_FILE" || fail 'mismatched completion status suppressed DNS recovery'
grep -Fxq 'dnsmasq-restart' "$FORKOP_CLI_DNS_EVENTS" || fail 'mismatched completion status skipped real DNS recovery'
[ -f "$FORKOP_CLI_DNS_READY" ] || fail 'mismatched completion status left the DNS forwarder unavailable'
assert_sources_unchanged

# An unexpected child failure never reaches normal completion acknowledgement.
# Production stop_main runs before the injected crash, leaving DNS recovery to
# the public CLI instead of pretending lifecycle handled the failed reload.
scenario=crash-after-stop
export FORKOP_CLI_DNS_SCENARIO="$scenario"
reset_fixture
run_cli reload
[ "$status" != 0 ] || fail 'crash after stopping runtime reported success'
grep -Fq 'fixture unexpected reload failure after stop' "$WORK/stderr" || fail 'crash scenario did not reach the injected failure after production stop_main'
[ ! -e "$FORKOP_CLI_DNS_RUNTIME" ] || fail 'crash scenario did not stop the core'
grep -Fxq 'dhcp.@dnsmasq[0].server=192.0.2.53' "$FORKOP_UCI_STATE_FILE" || fail 'unexpected reload crash left DNS forwarding to the stopped core'
grep -Fxq 'dnsmasq-restart' "$FORKOP_CLI_DNS_EVENTS" || fail 'unexpected reload crash skipped real DNS recovery'
assert_sources_unchanged
[ "$failed" = 0 ] || exit 1
printf 'PASS: rejected Apply preserves DNS; loader, cleanup retry, status mismatch and crash recovery remain active\n'
