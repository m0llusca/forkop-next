#!/usr/bin/env bash
# Execute the real recipe validation/metadata without an OpenWrt SDK.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
for recipe in forkop luci-app-forkop; do
  awk '!/^include / {print} /^PKG_RELEASE:=/ {exit}' "$ROOT_DIR/$recipe/Makefile" > "$WORK_DIR/recipe.mk"
  printf '\nprint-version:\n\t@printf '\''%%s|%%s|%%s\\n'\'' '\''$(PKG_VERSION)'\'' '\''$(PKG_RELEASE)'\'' '\''$(FORKOP_COMPILED_VERSION)'\''\n' >> "$WORK_DIR/recipe.mk"
  for variable in FORKOP_PACKAGE_VERSION FORKOP_VERSION; do
    for version in 0.0.1 1.2.1 1.2.1-r2 1.2.1-r10; do
      actual="$(make --no-print-directory -f "$WORK_DIR/recipe.mk" "$variable=$version" print-version)" || fail "$recipe rejected $version"
      [ "$actual" = "$version||$version" ] || fail "$recipe changed full version identity"
    done
    for version in v1.2.1 1.2 1.2.1.4 1.2.1-r0 1.2.1-r01 1.2.1-r 1.2.1-r-1 1.2.1-r1.1 '1.2.1-r2;true' "1.2.1'; touch $WORK_DIR/injected; #"; do
      if make --no-print-directory -f "$WORK_DIR/recipe.mk" "$variable=$version" print-version >/dev/null 2>&1; then fail "$recipe accepted malformed $version"; fi
      [ ! -e "$WORK_DIR/injected" ] || fail "$recipe executed release version as shell code"
    done
  done
  actual="$(make --no-print-directory -f "$WORK_DIR/recipe.mk" print-version)"
  [ "$actual" = '0.0.0||dev' ] || fail "$recipe changed development fallback"
done
printf 'release version SDK recipe checks passed\n'
