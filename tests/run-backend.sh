#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
report="${FORKOP_TEST_REPORT_DIR:-/tmp/forkop-test-report-$$}"
mkdir -p "$report"
export FORKOP_TEST_REPORT_DIR="$report"
printf '%s\0' tests/*.sh | while IFS= read -r -d '' file; do
  [ "$file" = tests/run-backend.sh ] || printf '%s\0' "$file"
done | xargs -0 -n1 -P2 bash -c '
  file="$1"; label="$(basename "$file")"
  timeout 180 bash "$file" > "$FORKOP_TEST_REPORT_DIR/$label.log" 2>&1
  code=$?
  printf "%s %s\n" "$code" "$label" >> "$FORKOP_TEST_REPORT_DIR/results"
  [ "$code" = 0 ] && printf "PASS %s\n" "$label" || printf "FAIL %s (%s)\n" "$label" "$code"
' _
python3 -m unittest discover -s tests/backend -v > "$report/python.log" 2>&1
python_status=$?
printf '%s python\n' "$python_status" >> "$report/results"
printf 'REPORT=%s\n' "$report"
awk '$1 != 0 {print; failed=1} END {exit failed}' "$report/results"
