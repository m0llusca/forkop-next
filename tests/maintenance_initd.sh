#!/bin/sh
# Execute the shipped init script through the relevant rc.common procd contract.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
export INIT_FIXTURE_EVENTS="$WORK/events"
cat > "$WORK/driver" <<'SH'
initscript=$1
action=$2
restart() { stop "$@"; start "$@"; }
. "$initscript"
initd_ucode() {
  printf 'backend %s\n' "$*" >> "$INIT_FIXTURE_EVENTS"
  case "$1" in stop-service) return "${STOP_STATUS:-0}";; start-service|restart-service) return "${START_STATUS:-0}";; esac
}
procd_open_service() { :; }
procd_close_service() { printf 'procd-close %s\n' "$1" >> "$INIT_FIXTURE_EVENTS"; }
procd_open_instance() { printf 'instance %s\n' "$1" >> "$INIT_FIXTURE_EVENTS"; }
procd_set_param() { :; }
procd_close_instance() { :; }
procd_lock() { :; }
procd_kill() { printf 'procd-kill %s %s\n' "$1" "$2" >> "$INIT_FIXTURE_EVENTS"; }
# These wrappers mirror target rc.common: a second rc_procd argument selects
# add; a stop argument selects an instance. Hook statuses need explicit owners.
rc_procd() {
  local method=set
  [ -n "$2" ] && method=add
  procd_open_service forkop "$initscript"
  "$@"
  procd_close_service "$method"
}
start() { rc_procd start_service "$@"; service_started; }
stop() { procd_lock; stop_service "$@"; procd_kill forkop "$1"; if type service_stopped >/dev/null 2>&1; then service_stopped; fi; }
"$action"
SH
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
run() { : > "$INIT_FIXTURE_EVENTS"; sh "$WORK/driver" "$ROOT/forkop/files/etc/init.d/forkop" "$1"; }
run restart || fail 'restart failed'
grep -q '^backend restart-service ' "$INIT_FIXTURE_EVENTS" || fail 'init.d restart bypassed maintenance lifecycle restart'
grep -Fxq 'instance next-expiry' "$INIT_FIXTURE_EVENTS" || fail 'restart lost timer registration'
grep -Fxq 'procd-close set' "$INIT_FIXTURE_EVENTS" || fail 'restart must register the complete service'
run maintenance_stop || fail 'maintenance stop command is unavailable'
grep -Eq '^backend stop-service [0-9]+ maintenance$' "$INIT_FIXTURE_EVENTS" || fail 'maintenance stop reason missing'
grep -Fxq 'procd-kill forkop ' "$INIT_FIXTURE_EVENTS" || fail 'maintenance stop must kill every procd instance'
run maintenance_start || fail 'maintenance start command is unavailable'
grep -Eq '^backend start-service maintenance [0-9]+$' "$INIT_FIXTURE_EVENTS" || fail 'maintenance start reason missing'
grep -Fxq 'procd-close set' "$INIT_FIXTURE_EVENTS" || fail 'maintenance start accidentally selected procd add'
if STOP_STATUS=6 run maintenance_stop; then fail 'procd swallowed stop failure'; fi
if START_STATUS=7 run restart; then fail 'procd swallowed restart failure'; fi
if START_STATUS=7 run maintenance_start; then fail 'procd swallowed start failure'; fi
printf 'PASS: maintenance initd commands, procd registration and failure propagation\n'
