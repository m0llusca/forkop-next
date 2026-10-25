#!/usr/bin/env bash
# Execute validation before any build directories, dependencies, or downloads.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
awk '{print} /^APK_INTERNAL_VERSION=/ {print "printf '\''%s\\n'\'' \"$APK_INTERNAL_VERSION\"; exit 0"; exit}' "$ROOT_DIR/build.sh" > "$WORK_DIR/build-prefix.sh"
# Execute the workflow's real selection/validation commands, stopping before Git
# output metadata and the release-notes Python command.
awk '/^          if \[ -n "\$INPUT_VERSION"/ {capture=1} capture && /^          echo "version=/ {print "printf '\''%s\\n'\'' \"$VERSION\"; exit 0"; exit} capture {sub(/^          /, ""); print}' "$ROOT_DIR/.github/workflows/build.yml" > "$WORK_DIR/workflow-prefix.sh"
[ -s "$WORK_DIR/workflow-prefix.sh" ] || fail 'workflow validation extraction failed'
for version in 0.0.1 1.2.1 1.2.1-r2 1.2.1-r10; do
  actual="$("${BASH:-bash}" "$WORK_DIR/build-prefix.sh" "$version")" || fail "builder rejected valid $version"
  [ "$actual" = "$version" ] || fail 'builder changed APK version identity'
  actual="$(INPUT_VERSION="$version" EVENT_NAME=workflow_dispatch "${BASH:-bash}" "$WORK_DIR/workflow-prefix.sh")" || fail "workflow rejected valid $version"
  [ "$actual" = "$version" ] || fail 'workflow changed version identity'
done
for version in '' v1.2.1 1.2 1.2.1.4 1.2.1-r0 1.2.1-r01 1.2.1-r 1.2.1-r-1 1.2.1-r1.1 '1.2.1-r2;true' '1.2.1$(true)'; do
  if "${BASH:-bash}" "$WORK_DIR/build-prefix.sh" "$version" >/dev/null 2>&1; then fail "builder accepted malformed $version"; fi
  if [ -n "$version" ] && INPUT_VERSION="$version" EVENT_NAME=workflow_dispatch "${BASH:-bash}" "$WORK_DIR/workflow-prefix.sh" >/dev/null 2>&1; then fail "workflow accepted malformed $version"; fi
done
actual="$(cd "$ROOT_DIR" && INPUT_VERSION=9.9.9 EVENT_NAME=pull_request "${BASH:-bash}" "$WORK_DIR/workflow-prefix.sh")"
[ "$actual" = "$(cat "$ROOT_DIR/VERSION")" ] || fail 'PR builds must use VERSION'
printf 'release version build and workflow entrypoint checks passed\n'
