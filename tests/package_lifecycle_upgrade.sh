#!/bin/sh
# Exercise real package lifecycle against temporary paths only; no live service calls.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
export FORKOP_PACKAGE_UPGRADE_STATE="$WORK/was-running"
export FORKOP_UCI_STATE_FILE="$WORK/uci.state"
export FORKOP_RT_TABLES="$WORK/rt_tables"
export FORKOP_INIT="$WORK/forkop-init"
export FORKOP_BIN="$WORK/forkop-bin"
export FORKOP_DNS_APPLY_UC="$WORK/missing-dns-apply"
export FORKOP_SING_BOX_INIT="$WORK/sing-box-init"
export FORKOP_SING_BOX_BIN="$WORK/sing-box"
export FORKOP_SING_BOX_CRONET="$WORK/libcronet.so"
export FORKOP_LIFECYCLE_LOG="$WORK/events"
unset FORKOP_PACKAGE_TEST_MODE IPKG_INSTROOT
cat > "$FORKOP_INIT" <<'SH'
#!/bin/sh
printf 'forkop %s\n' "$1" >> "$FORKOP_LIFECYCLE_LOG"
case "$1" in
  status) exit "${FORKOP_FAKE_STATUS:-0}";;
  maintenance_stop) exit "${FORKOP_FAKE_STOP_STATUS:-0}";;
  maintenance_start) exit "${FORKOP_FAKE_START_STATUS:-0}";;
esac
SH
cat > "$FORKOP_BIN" <<'SH'
#!/bin/sh
printf 'command %s\n' "$1" >> "$FORKOP_LIFECYCLE_LOG"
case "$1" in
  maintenance_snapshot)
    [ "${FORKOP_FAKE_SNAPSHOT_STATUS:-0}" = 0 ] || exit "$FORKOP_FAKE_SNAPSHOT_STATUS"
    printf '%s\n' '{"config_hash":"fixture","selections":{"main":"b"}}';;
esac
SH
cat > "$FORKOP_SING_BOX_INIT" <<'SH'
#!/bin/sh
# Forkop managed sing-box service for binary variants
printf 'sing-box %s\n' "$1" >> "$FORKOP_LIFECYCLE_LOG"
SH
chmod +x "$FORKOP_INIT" "$FORKOP_BIN" "$FORKOP_SING_BOX_INIT"
printf 'forkop.settings=settings\nforkop.settings.dont_touch_dhcp=0\n' > "$FORKOP_UCI_STATE_FILE"
printf 'custom-core-bytes\n' > "$FORKOP_SING_BOX_BIN"
printf 'library-bytes\n' > "$FORKOP_SING_BOX_CRONET"
cp "$FORKOP_SING_BOX_INIT" "$WORK/init.before"
printf '105 forkop\n200 unrelated\n' > "$FORKOP_RT_TABLES"
: > "$FORKOP_LIFECYCLE_LOG"
package() { ucode -L "$ROOT/forkop/files/usr/lib" "$ROOT/forkop/files/usr/lib/service/package.uc" "$@"; }

# APK's backend-pre-upgrade explicitly passes upgrade to this production dispatcher.
package prerm upgrade
[ -f "$FORKOP_SING_BOX_BIN" ] || fail 'upgrade deleted the installed custom core'
[ "$(cat "$FORKOP_SING_BOX_BIN")" = 'custom-core-bytes' ] || fail 'upgrade changed custom core bytes'
cmp "$WORK/init.before" "$FORKOP_SING_BOX_INIT" || fail 'upgrade changed managed core init'
[ "$(cat "$FORKOP_SING_BOX_CRONET")" = 'library-bytes' ] || fail 'upgrade changed core library'
grep -Fxq 'forkop maintenance_stop' "$FORKOP_LIFECYCLE_LOG" || fail 'upgrade did not use maintenance stop'
if grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG"; then fail 'upgrade exposed ordinary DNS during maintenance'; fi
if grep -q '^sing-box ' "$FORKOP_LIFECYCLE_LOG"; then fail 'upgrade separately stopped or disabled managed core'; fi
[ -f "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'upgrade forgot running state'
ucode -e 'let s=require("fs").stat(getenv("FORKOP_PACKAGE_UPGRADE_STATE"));exit(s && (s.mode & 511)==384?0:1);' || fail 'upgrade state must be private'
ucode -e 'let s=json(require("fs").readfile(getenv("FORKOP_PACKAGE_UPGRADE_STATE")));exit(s.selector_state.selections.main=="b"?0:1);' || fail 'upgrade forgot selectors'
grep -Fxq '200 unrelated' "$FORKOP_RT_TABLES" || fail 'upgrade removed unrelated route table'
if grep -Fq '105 forkop' "$FORKOP_RT_TABLES"; then fail 'upgrade kept managed route table'; fi
package postinst
grep -Fxq 'forkop maintenance_start' "$FORKOP_LIFECYCLE_LOG" || fail 'postinst failed to resume with maintenance start'
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'postinst left running marker'
printf 'PASS: running upgrade preserves core, DNS, selectors and resumes\n'

: > "$FORKOP_LIFECYCLE_LOG"
FORKOP_FAKE_STATUS=1 package prerm upgrade
package postinst
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'stopped upgrade wrote resume marker'
if grep -Eq '^forkop (start|maintenance_start)$' "$FORKOP_LIFECYCLE_LOG"; then fail 'postinst started previously stopped service'; fi
[ -f "$FORKOP_SING_BOX_BIN" ] || fail 'stopped upgrade deleted custom core'
printf 'PASS: stopped service remains stopped through upgrade\n'

# A previous interrupted upgrade must not start a service now intentionally stopped.
package prerm upgrade
[ -f "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'running upgrade did not create marker for retry scenario'
: > "$FORKOP_LIFECYCLE_LOG"
FORKOP_FAKE_STATUS=1 package prerm upgrade
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'stopped retry retained stale running marker'
package postinst
if grep -Eq '^forkop (start|maintenance_start)$' "$FORKOP_LIFECYCLE_LOG"; then fail 'stale upgrade marker started previously stopped service'; fi
printf 'PASS: stopped retry clears a stale running marker\n'

: > "$FORKOP_LIFECYCLE_LOG"
if FORKOP_FAKE_SNAPSHOT_STATUS=6 package prerm upgrade; then fail 'upgrade accepted missing selector snapshot'; fi
if grep -Eq '^forkop (stop|maintenance_stop)$|^command restore_dnsmasq$' "$FORKOP_LIFECYCLE_LOG"; then fail 'snapshot failure disturbed the running service'; fi
printf 'PASS: snapshot failure aborts before runtime changes\n'

: > "$FORKOP_LIFECYCLE_LOG"
if FORKOP_FAKE_STOP_STATUS=7 package prerm upgrade; then fail 'upgrade swallowed maintenance stop failure'; fi
grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG" || fail 'failed maintenance stop did not restore DNS'
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'failed maintenance stop left a resume marker'
printf 'PASS: failed maintenance stop aborts upgrade and restores DNS\n'

package prerm upgrade
: > "$FORKOP_LIFECYCLE_LOG"
if FORKOP_FAKE_START_STATUS=8 package postinst; then fail 'postinst swallowed start failure'; fi
grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG" || fail 'failed postinst did not restore DNS'
[ -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'failed postinst lost recovery snapshot'
package postinst

# Old hooks leave a plain running marker, which must keep ordinary recovery.
printf '1\n' > "$FORKOP_PACKAGE_UPGRADE_STATE"
: > "$FORKOP_LIFECYCLE_LOG"
package postinst
grep -Fxq 'forkop start' "$FORKOP_LIFECYCLE_LOG" || fail 'legacy marker bypassed ordinary startup recovery'
printf 'PASS: legacy upgrade marker retains ordinary recovery\n'

printf '%s\n' '{"version":1,"selector_state":{"config_hash":"fixture","selections":{}}}' > "$FORKOP_PACKAGE_UPGRADE_STATE"
chmod 0644 "$FORKOP_PACKAGE_UPGRADE_STATE"
: > "$FORKOP_LIFECYCLE_LOG"
if package postinst; then fail 'non-private JSON handoff authorized maintenance start'; fi
if grep -Fxq 'forkop maintenance_start' "$FORKOP_LIFECYCLE_LOG"; then fail 'non-private JSON bypassed recovery'; fi
grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG" || fail 'untrusted handoff did not restore DNS'
printf 'PASS: non-private JSON cannot authorize maintenance resume\n'

if ucode -e 'exit(require("fs").stat("/proc/self").uid==0?0:1);' && command -v chown >/dev/null 2>&1; then
  chmod 0600 "$FORKOP_PACKAGE_UPGRADE_STATE"
  chown 65534:65534 "$FORKOP_PACKAGE_UPGRADE_STATE"
  : > "$FORKOP_LIFECYCLE_LOG"
  if package postinst; then fail 'foreign-owned handoff authorized maintenance start'; fi
  if grep -Fxq 'forkop maintenance_start' "$FORKOP_LIFECYCLE_LOG"; then fail 'foreign owner bypassed recovery'; fi
  printf 'PASS: foreign-owned JSON cannot authorize maintenance resume\n'
fi

rm -f "$FORKOP_PACKAGE_UPGRADE_STATE"
printf '{}\n' > "$FORKOP_PACKAGE_UPGRADE_STATE"
chmod 0600 "$FORKOP_PACKAGE_UPGRADE_STATE"
: > "$FORKOP_LIFECYCLE_LOG"
if package postinst; then fail 'malformed upgrade state was accepted'; fi
grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG" || fail 'malformed handoff left forwarding stranded'
if grep -Fxq 'forkop maintenance_start' "$FORKOP_LIFECYCLE_LOG"; then fail 'malformed handoff bypassed startup recovery'; fi
printf 'PASS: malformed handoff fails safely\n'

package prerm remove
[ ! -e "$FORKOP_SING_BOX_BIN" ] || fail 'remove retained managed core'
[ ! -e "$FORKOP_SING_BOX_INIT" ] || fail 'remove retained managed init'
[ ! -e "$FORKOP_SING_BOX_CRONET" ] || fail 'remove retained managed library'
grep -Fxq 'sing-box stop' "$FORKOP_LIFECYCLE_LOG" || fail 'remove failed to stop managed core'
grep -Fxq 'sing-box disable' "$FORKOP_LIFECYCLE_LOG" || fail 'remove failed to disable managed core'
printf 'PASS: explicit remove still performs complete managed core cleanup\n'

printf '#!/bin/sh\nexit 0\n' > "$FORKOP_SING_BOX_INIT"
chmod +x "$FORKOP_SING_BOX_INIT"
printf 'unmanaged-core\n' > "$FORKOP_SING_BOX_BIN"
printf 'unmanaged-library\n' > "$FORKOP_SING_BOX_CRONET"
package prerm remove
[ -f "$FORKOP_SING_BOX_INIT" ] && [ -f "$FORKOP_SING_BOX_BIN" ] && [ -f "$FORKOP_SING_BOX_CRONET" ] || fail 'remove deleted unmanaged core assets'
printf 'PASS: remove preserves unmanaged core assets\n'
