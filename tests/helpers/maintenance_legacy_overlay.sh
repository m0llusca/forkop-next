#!/bin/sh
# Optional integration fixture, supplied only with a verified code-only old tree.
# This never installs files: the complete overlay and all commands stay in tmp.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LEGACY=${FORKOP_LEGACY_CODE_ROOT:?set FORKOP_LEGACY_CODE_ROOT to verified old program code}
[ -f "$LEGACY/usr/lib/forkop/service/package.uc" ] || exit 1
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
mkdir -p "$WORK/forkop/files/usr/lib" "$WORK/forkop/files/usr/bin" "$WORK/forkop/files/etc/init.d" "$WORK/tests/helpers"
cp -R "$LEGACY/usr/lib/forkop/." "$WORK/forkop/files/usr/lib/"
# The compatibility adapter consists of exactly these five versioned files.
for relative in usr/lib/service/lifecycle.uc usr/lib/service/initd.uc usr/lib/service/package.uc usr/bin/forkop etc/init.d/forkop; do
  cp "$ROOT/forkop/files/$relative" "$WORK/forkop/files/$relative"
done
cp "$ROOT/build.sh" "$WORK/build.sh"
cp "$ROOT/forkop/Makefile" "$WORK/forkop/Makefile"
cp "$ROOT/tests/helpers/maintenance_lifecycle.uc" "$ROOT/tests/helpers/maintenance_initd.uc" "$WORK/tests/helpers/"
for test in maintenance_lifecycle maintenance_initd package_lifecycle_upgrade package_maintenance_hooks; do
  cp "$ROOT/tests/$test.sh" "$WORK/tests/$test.sh"
  sh "$WORK/tests/$test.sh"
done
printf 'PASS: five-file maintenance overlay with legacy program dependencies\n'
