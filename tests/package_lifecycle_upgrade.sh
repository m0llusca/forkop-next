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
case "$1" in status) exit "${FORKOP_FAKE_STATUS:-0}";; esac
SH
cat > "$FORKOP_BIN" <<'SH'
#!/bin/sh
printf 'command %s\n' "$1" >> "$FORKOP_LIFECYCLE_LOG"
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
grep -Fxq 'forkop stop' "$FORKOP_LIFECYCLE_LOG" || fail 'upgrade did not stop Forkop'
grep -Fxq 'command restore_dnsmasq' "$FORKOP_LIFECYCLE_LOG" || fail 'upgrade skipped DNS restoration'
if grep -q '^sing-box ' "$FORKOP_LIFECYCLE_LOG"; then fail 'upgrade separately stopped or disabled managed core'; fi
[ -f "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'upgrade forgot running state'
grep -Fxq '200 unrelated' "$FORKOP_RT_TABLES" || fail 'upgrade removed unrelated route table'
if grep -Fq '105 forkop' "$FORKOP_RT_TABLES"; then fail 'upgrade kept managed route table'; fi
package postinst
grep -Fxq 'forkop start' "$FORKOP_LIFECYCLE_LOG" || fail 'postinst failed to resume previously running service'
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'postinst left running marker'
printf 'PASS: upgrade preserves core, init and library while keeping stop/DNS/resume lifecycle\n'

: > "$FORKOP_LIFECYCLE_LOG"
FORKOP_FAKE_STATUS=1 package prerm upgrade
package postinst
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'stopped upgrade wrote resume marker'
if grep -Fxq 'forkop start' "$FORKOP_LIFECYCLE_LOG"; then fail 'postinst started previously stopped service'; fi
[ -f "$FORKOP_SING_BOX_BIN" ] || fail 'stopped upgrade deleted custom core'
printf 'PASS: stopped service remains stopped through upgrade\n'

# A previous interrupted upgrade must not start a service now intentionally stopped.
package prerm upgrade
[ -f "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'running upgrade did not create marker for retry scenario'
: > "$FORKOP_LIFECYCLE_LOG"
FORKOP_FAKE_STATUS=1 package prerm upgrade
[ ! -e "$FORKOP_PACKAGE_UPGRADE_STATE" ] || fail 'stopped retry retained stale running marker'
package postinst
if grep -Fxq 'forkop start' "$FORKOP_LIFECYCLE_LOG"; then fail 'stale upgrade marker started previously stopped service'; fi
printf 'PASS: stopped retry clears a stale running marker\n'

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
