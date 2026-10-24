#!/bin/sh
# Behavioral regression: status must not start the compressed core to show its version.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
export FORKOP_LIB="$ROOT/forkop/files/usr/lib"
export FORKOP_CONFIG_FILE="$WORK/forkop"
export FORKOP_NEXT_DIR="$WORK/next"
export SB_VARIANT_STATE_FILE="$WORK/variant"
export SB_VERSION_STATE_FILE="$WORK/version"
export FORKOP_TEST_CALLS="$WORK/calls"
export FORKOP_TEST_OUTPUT="$WORK/output"
export FORKOP_TEST_EXIT="$WORK/exit"
mkdir "$WORK/bin"
export PATH="$WORK/bin:$PATH"
printf "config settings 'settings'\n\toption smart_detect_enabled '0'\n" > "$FORKOP_CONFIG_FILE"
cat > "$WORK/bin/sing-box" <<'CORE'
#!/bin/sh
printf '%s\n' "$*" >> "$FORKOP_TEST_CALLS"
cat "$FORKOP_TEST_OUTPUT"
exit "$(cat "$FORKOP_TEST_EXIT")"
CORE
chmod +x "$WORK/bin/sing-box"
cat > "$WORK/assert.uc" <<'ASSERT'
let fs=require('fs'), result=json(fs.readfile(ARGV[0]));
if (!result.success || result.data.versions.sing_box != ARGV[1]) {
    warn('FAIL: '+ARGV[2]+': expected version '+ARGV[1]+', got '+sprintf('%J',result)+'\n');
    exit(1);
}
if (type(result.data.digest) != 'string' || length(result.data.digest) != 64 ||
    result.data.recovery_pending != false || result.data.previous_available != false ||
    length(result.data.sections) != 0 || result.data.smart_detect.enabled != false) {
    warn('FAIL: '+ARGV[2]+': status contract changed\n');
    exit(1);
}
ASSERT
failed=0
check() {
    label=$1 expected=$2 calls=$3
    : > "$FORKOP_TEST_CALLS"
    ucode -L "$FORKOP_LIB" "$FORKOP_LIB/service/next.uc" next status '{}' > "$WORK/result.json"
    if ! ucode "$WORK/assert.uc" "$WORK/result.json" "$expected" "$label"; then failed=1; fi
    actual=$(wc -l < "$FORKOP_TEST_CALLS" | tr -d ' ')
    if [ "$actual" != "$calls" ]; then
        printf 'FAIL: %s: expected %s core launches, got %s\n' "$label" "$calls" "$actual" >&2
        failed=1
    else
        printf 'PASS: %s core launch count (%s)\n' "$label" "$calls"
    fi
}
printf 'extended-compressed\n' > "$SB_VARIANT_STATE_FILE"
printf '1.12.25-extended\n' > "$SB_VERSION_STATE_FILE"
printf 'sing-box version 1.12.25-extended\n' > "$FORKOP_TEST_OUTPUT"
printf '0\n' > "$FORKOP_TEST_EXIT"
check compressed-state 1.12.25-extended 0
rm "$SB_VERSION_STATE_FILE"
check compressed-missing-version unknown 0
printf 'not-a-version\n' > "$SB_VERSION_STATE_FILE"
check compressed-invalid-version unknown 0
printf 'stable\n' > "$SB_VARIANT_STATE_FILE"
printf '9.99-stale\n' > "$SB_VERSION_STATE_FILE"
printf 'sing-box version 1.12.25\nEnvironment: linux/mipsle\n' > "$FORKOP_TEST_OUTPUT"
check stable-live-version 1.12.25 1
rm "$SB_VARIANT_STATE_FILE"
check unmarked-live-version 1.12.25 1
printf '42\n' > "$FORKOP_TEST_EXIT"
check failed-core-version unknown 1
printf '0\n' > "$FORKOP_TEST_EXIT"
printf 'unexpected output\n' > "$FORKOP_TEST_OUTPUT"
check invalid-core-version unknown 1
exit "$failed"
