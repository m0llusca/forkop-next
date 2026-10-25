#!/bin/sh
# Execute emitted package hooks with every absolute executable redirected to fixtures.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
export FORKOP_HOOK_EVENTS="$WORK/events"
unset IPKG_INSTROOT
cat > "$WORK/forkop" <<'SH'
#!/bin/sh
printf '%s\n' "$1" >> "$FORKOP_HOOK_EVENTS"
[ "$1" != package_prerm ] || exit 7
[ "$1" != package_postinst ] || exit "${FAIL_POSTINST_STATUS:-0}"
[ "$1" != restore_dnsmasq ] || [ "${FAIL_RESTORE_LOADER:-0}" = 0 ] || exit 9
exit 0
SH
chmod +x "$WORK/forkop"
printf 'exit(8);\n' > "$WORK/migration.uc"
cat > "$WORK/dns.uc" <<'UC'
let f=require('fs').open(getenv('FORKOP_HOOK_EVENTS'),'a');f.write('direct-failsafe\n');f.close();
UC
extract_build() {
  awk -v marker="$1" 'index($0,marker){found=1;next} found && $0=="EOF"{exit} found{print}' "$ROOT/build.sh"
}
extract_make() {
  awk -v marker="define Package/forkop/$1" '$0==marker{found=1;next} found && $0=="endef"{exit} found{print}' "$ROOT/forkop/Makefile" | sed 's/\$\$/\$/g'
}
prepare() {
  sed "s|/usr/bin/forkop|$WORK/forkop|g; s|/usr/lib/forkop/config/migration.uc|$WORK/migration.uc|g; s|/usr/lib/forkop/dns/apply.uc|$WORK/dns.uc|g"
}
extract_build 'cat > "$control_dir/prerm"' | prepare > "$WORK/ipk-prerm"
extract_make prerm | prepare > "$WORK/make-prerm"
extract_build 'cat > "$scripts_dir/backend-pre-upgrade.sh"' | prepare > "$WORK/apk-prerm"
extract_build 'cat > "$control_dir/postinst"' | prepare > "$WORK/ipk-postinst"
extract_make postinst | prepare > "$WORK/make-postinst"
extract_build 'cat > "$scripts_dir/backend-post-upgrade.sh"' | prepare > "$WORK/apk-postinst"
failed=0
for flavor in ipk make apk; do
  status=0
  ucode "$WORK/$flavor-prerm" upgrade || status=$?
  if [ "$status" != 7 ]; then printf 'FAIL: %s prerm swallowed stop failure (%s)\n' "$flavor" "$status"; failed=1; fi
  : > "$FORKOP_HOOK_EVENTS"
  status=0
  if [ "$flavor" = apk ]; then ucode "$WORK/$flavor-postinst" || status=$?
  else sh "$WORK/$flavor-postinst" || status=$?; fi
  if [ "$status" != 8 ]; then printf 'FAIL: %s migration failure exit changed (%s)\n' "$flavor" "$status"; failed=1; fi
  if ! grep -Fxq restore_dnsmasq "$FORKOP_HOOK_EVENTS"; then printf 'FAIL: %s migration failure stranded maintenance DNS\n' "$flavor"; failed=1; fi
  if grep -Fxq package_postinst "$FORKOP_HOOK_EVENTS"; then printf 'FAIL: %s resumed after failed migration\n' "$flavor"; failed=1; fi
  : > "$FORKOP_HOOK_EVENTS"
  status=0
  if [ "$flavor" = apk ]; then FAIL_RESTORE_LOADER=1 ucode "$WORK/$flavor-postinst" || status=$?
  else FAIL_RESTORE_LOADER=1 sh "$WORK/$flavor-postinst" || status=$?; fi
  if [ "$status" != 8 ] || ! grep -Fxq direct-failsafe "$FORKOP_HOOK_EVENTS"; then
    printf 'FAIL: %s missing restore loader bypassed fallback or changed status\n' "$flavor"; failed=1
  fi
  # A package can have a usable migration module but a missing/broken CLI.
  printf 'exit(0);\n' > "$WORK/migration.uc"
  for expected in 6 127; do
    : > "$FORKOP_HOOK_EVENTS"
    status=0
    if [ "$flavor" = apk ]; then FAIL_POSTINST_STATUS="$expected" FAIL_RESTORE_LOADER=1 ucode "$WORK/$flavor-postinst" || status=$?
    else FAIL_POSTINST_STATUS="$expected" FAIL_RESTORE_LOADER=1 sh "$WORK/$flavor-postinst" || status=$?; fi
    if [ "$status" != "$expected" ] || ! grep -Fxq direct-failsafe "$FORKOP_HOOK_EVENTS"; then
      printf 'FAIL: %s failed postinst CLI stranded DNS or changed status (%s)\n' "$flavor" "$status"; failed=1
    fi
  done
  printf 'exit(8);\n' > "$WORK/migration.uc"
done
exit "$failed"
