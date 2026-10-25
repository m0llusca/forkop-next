#!/bin/sh
# Offline release identity tests: no package manager, service, or network calls.
set -eu
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UPDATER="$ROOT_DIR/forkop/files/usr/lib/components/updater.uc"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
assert_eq() { [ "$1" = "$2" ] || fail "$3: expected '$1', got '$2'"; }

# Extract the actual embedded installer helper, without executing the installer.
awk '/cat > "\$helper_path" <<'\''EOF'\''/ { capture=1; next } capture && /^EOF$/ { exit } capture { print }' "$ROOT_DIR/install.sh" > "$WORK_DIR/installer.uc"
[ -s "$WORK_DIR/installer.uc" ] || fail 'embedded installer helper missing'

for version in 0.0.1 1.2.1 1.2.1-r1 1.2.1-r2 1.2.1-r10 1.2.2; do
  ucode "$UPDATER" forkop-release-version-valid "$version" || fail "valid release rejected: $version"
done
for version in '' v1.2.1 1.2 1.2.1.0 1.2.1-r0 1.2.1-r01 1.2.1-r 1.2.1-r-1 1.2.1-r1.1 1.2.1-r2x 1.2.1-r2-r3 '1.2.1-r2;true' '1.2.1$(true)' '1.2.1-r2
'; do
  if ucode "$UPDATER" forkop-release-version-valid "$version"; then fail "malformed release accepted: $version"; fi
  if ucode "$UPDATER" forkop-release-version-compare "$version" 1.2.1 >/dev/null; then fail 'malformed comparison accepted'; fi
done
while read -r lhs rhs expected; do
  assert_eq "$expected" "$(ucode "$UPDATER" forkop-release-version-compare "$lhs" "$rhs")" "comparison $lhs / $rhs"
done <<'CASES'
1.2.1 1.2.1 0
1.2.1 1.2.1-r2 -1
1.2.1-r2 1.2.1 1
1.2.1-r2 1.2.1-r2 0
1.2.1-r2 1.2.1-r10 -1
1.2.1-r10 1.2.1-r2 1
1.2.1-r10 1.2.2 -1
1.2.2 1.2.1-r10 1
1.9.9-r99 1.10.0 -1
CASES

for version in 0.0.1 1.2.1-r2; do
  for ext in ipk apk; do
    # Decoys precede the exact files so prefix/substring matching cannot pass.
    release="{\"tag_name\":\"$version\",\"html_url\":\"https://example.invalid/release\",\"assets\":[{\"name\":\"forkop_${version}_all.$ext\",\"browser_download_url\":\"https://example.invalid/decoy\"},{\"name\":\"forkop_$version.$ext\",\"browser_download_url\":\"https://example.invalid/backend\"},{\"name\":\"luci-app-forkop_$version.$ext\",\"browser_download_url\":\"https://example.invalid/app\"},{\"name\":\"luci-i18n-forkop-ru_$version.$ext\",\"browser_download_url\":\"https://example.invalid/i18n\"}]}"
    expected="$(printf 'https://example.invalid/release\tforkop_%s.%s\thttps://example.invalid/backend\tluci-app-forkop_%s.%s\thttps://example.invalid/app\tluci-i18n-forkop-ru_%s.%s\thttps://example.invalid/i18n' "$version" "$ext" "$version" "$ext" "$version" "$ext")"
    assert_eq "$expected" "$(printf '%s' "$release" | ucode "$UPDATER" forkop-release-plan "$version" "$ext" 1)" 'exact release plan'
    for kind in backend app i18n; do
      assert_eq "https://example.invalid/$kind" "$(printf '%s' "$release" | ucode "$WORK_DIR/installer.uc" release-asset-url "$kind" "$ext")" "installer $kind $version $ext"
    done
    if printf '%s' "$release" | ucode "$UPDATER" forkop-release-plan 9.9.9 "$ext" 0 >/dev/null; then fail 'release tag mismatch accepted'; fi
  done
done
for version in 1.2.1-r0 1.2.1-r01 1.2.1-r-1 1.2.1-r2x '1.2.1;true'; do
  release="{\"tag_name\":\"$version\",\"assets\":[{\"name\":\"forkop_$version.apk\",\"browser_download_url\":\"https://example.invalid/backend\"},{\"name\":\"luci-app-forkop_$version.apk\",\"browser_download_url\":\"https://example.invalid/app\"},{\"name\":\"luci-i18n-forkop-ru_$version.apk\",\"browser_download_url\":\"https://example.invalid/i18n\"}]}"
  for kind in backend app i18n; do
    assert_eq '' "$(printf '%s' "$release" | ucode "$WORK_DIR/installer.uc" release-asset-url "$kind" apk)" 'installer malformed release with exact assets'
  done
  if printf '%s' "$release" | ucode "$UPDATER" forkop-release-plan "$version" apk 1 >/dev/null; then fail 'malformed release plan with complete exact assets accepted'; fi
done
for version in 1.2.1-r0 1.2.1-r01 1.2.1-r2; do
  release="{\"tag_name\":\"$version\",\"assets\":[{\"name\":\"forkop_1.2.1.apk\",\"browser_download_url\":\"https://example.invalid/wrong\"}]}"
  assert_eq '' "$(printf '%s' "$release" | ucode "$WORK_DIR/installer.uc" release-asset-url backend apk)" 'installer malformed or different revision asset'
  if printf '%s' "$release" | ucode "$UPDATER" forkop-release-plan "$version" apk 0 >/dev/null; then fail 'invalid or incomplete revision plan accepted'; fi
done
printf 'release revision parser and identity checks passed\n'
