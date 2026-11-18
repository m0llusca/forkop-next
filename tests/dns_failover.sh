#!/usr/bin/env bash
set -eo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORKOP_LIB="$ROOT_DIR/forkop/files/usr/lib"
GENERATOR="$FORKOP_LIB/singbox/generator.uc"
FAILOVER="$FORKOP_LIB/singbox/dns_failover.uc"
WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

generate() {
  local fixture="$1"
  local output="$2"
  local state="${3:-$WORK_DIR/missing-state.json}"
  FORKOP_LIB="$FORKOP_LIB" \
    FORKOP_DNS_FAILOVER_STATE_FILE="$state" \
    ucode -L "$FORKOP_LIB" "$GENERATOR" generate-config-fixture "$fixture" "$output" 192.168.1.1 0
}

cat >"$WORK_DIR/single.json" <<'JSON'
{
  "settings": {
    ".name": "settings",
    ".type": "settings",
    "dns_type": "udp",
    "dns_server": "77.88.8.8",
    "bootstrap_dns_server": "77.88.8.8"
  },
  "section": [
    {
      ".name": "direct",
      ".type": "section",
      "enabled": "1",
      "action": "bypass",
      "domain_suffix": [ "example.org" ]
    }
  ]
}
JSON

cat >"$WORK_DIR/multi.json" <<'JSON'
{
  "settings": {
    ".name": "settings",
    ".type": "settings",
    "dns_type": "doh",
    "dns_server": [ "dns.google/dns-query", "cloudflare-dns.com/dns-query" ],
    "bootstrap_dns_server": [ "1.1.1.1", "8.8.8.8" ],
    "dns_check_interval": "10s",
    "dns_recovery_check_interval": "60s",
    "dns_check_timeout": "2s",
    "dns_detour_enabled": "1",
    "dns_detour_section": "proxy"
  },
  "section": [
    {
      ".name": "proxy",
      ".type": "section",
      "enabled": "1",
      "action": "outbound",
      "outbound_json": "{\"type\":\"direct\",\"tag\":\"fixture\"}",
      "domain_suffix": [ "example.org" ]
    }
  ]
}
JSON

cat >"$WORK_DIR/state.json" <<'JSON'
{
  "version": 1,
  "dns_type": "doh",
  "dns_detour": "proxy-out",
  "main_servers": [ "dns.google/dns-query", "cloudflare-dns.com/dns-query" ],
  "bootstrap_servers": [ "1.1.1.1", "8.8.8.8" ],
  "main_index": 1,
  "bootstrap_index": 1
}
JSON

generate "$WORK_DIR/single.json" "$WORK_DIR/single-config.json"
generate "$WORK_DIR/multi.json" "$WORK_DIR/multi-config.json" "$WORK_DIR/state.json"

ucode -e '
let fs = require("fs");

function cfg(path) { return json(fs.readfile(path)); }
function assert(value, message) { if (!value) { warn("FAIL: ", message, "\n"); exit(1); } }
function find_tag(values, tag) { for (let value in values || []) if (value.tag == tag) return value; return null; }
function count_prefix(values, prefix) { let count = 0; for (let value in values || []) if (index(value.tag || "", prefix) == 0) count++; return count; }

let single = cfg(ARGV[0]);
assert(length(single.dns.servers) == 3, "singleton keeps the legacy three-server shape");
assert(length(single.inbounds) == 3, "singleton adds no health inbounds");
assert(count_prefix(single.dns.servers, "dns-health-") == 0, "singleton adds no health servers");
assert(find_tag(single.dns.servers, "dns-server").server == "77.88.8.8", "singleton main DNS preserved");
assert(single.route.default_domain_resolver == "dns-server", "singleton keeps main default resolver");

let multi = cfg(ARGV[1]);
assert(length(multi.dns.servers) == 7, "two main and two bootstrap candidates are generated");
assert(length(multi.inbounds) == 8, "candidate and active health inbounds are generated");
assert(count_prefix(multi.dns.servers, "dns-health-main-") == 2, "main health servers generated");
assert(count_prefix(multi.dns.servers, "dns-health-bootstrap-") == 2, "bootstrap health servers generated");
let main = find_tag(multi.dns.servers, "dns-server");
let bootstrap = find_tag(multi.dns.servers, "bootstrap-dns-server");
assert(main.server == "cloudflare-dns.com", "runtime main index selects the second server");
assert(main.detour == "proxy-out", "main DNS uses selected section detour");
assert(main.domain_resolver == "bootstrap-dns-server", "main hostname uses direct bootstrap resolver");
assert(bootstrap.server == "8.8.8.8" && bootstrap.detour == null, "bootstrap index selects direct second server");
assert(multi.route.default_domain_resolver == "bootstrap-dns-server", "detour mode breaks endpoint DNS cycles with bootstrap");
let health_rules = 0;
for (let rule in multi.dns.rules || []) {
    if (index(rule.inbound || "", "dns-health-") == 0) {
        health_rules++;
        assert(rule.disable_cache === true, "health checks bypass DNS cache");
    }
}
assert(health_rules == 5, "each candidate and the canonical active DNS have an inbound-specific rule");
' "$WORK_DIR/single-config.json" "$WORK_DIR/multi-config.json"

cat >"$WORK_DIR/select-state.json" <<'JSON'
{
  "main_servers": [ "first", "second", "third" ],
  "bootstrap_servers": [ "a", "b" ],
  "main_index": 0,
  "bootstrap_index": 1
}
JSON
cat >"$WORK_DIR/alive-failover.json" <<'JSON'
{ "0": false, "1": true, "2": true }
JSON
cat >"$WORK_DIR/alive-recovery.json" <<'JSON'
{ "0": true, "1": true }
JSON

selected="$(ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-failover.json" main 0)"
printf '%s' "$selected" | grep -Eq '"index"[[:space:]]*:[[:space:]]*1' || fail "dead active DNS must select the first live server below"
printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"active_dead"' || fail "failover reason"

selected="$(ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-recovery.json" bootstrap 1)"
printf '%s' "$selected" | grep -Eq '"index"[[:space:]]*:[[:space:]]*0' || fail "recovery must return to the highest live priority"
printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"recovery"' || fail "recovery reason"

cat >"$WORK_DIR/verify-previous.json" <<'JSON'
{ "main_index": 0, "bootstrap_index": 0, "bootstrap_servers": [ "a", "b" ] }
JSON
cat >"$WORK_DIR/verify-bootstrap.json" <<'JSON'
{ "main_index": 0, "bootstrap_index": 1, "bootstrap_servers": [ "a", "b" ] }
JSON

verification="$(ucode -L "$FORKOP_LIB" "$FAILOVER" verification-plan-fixture "$WORK_DIR/verify-previous.json" "$WORK_DIR/verify-bootstrap.json")"
printf '%s' "$verification" | grep -Eq '"main"[[:space:]]*:[[:space:]]*false' || fail "bootstrap-only switch must not require a dead main DNS to recover"
printf '%s' "$verification" | grep -Eq '"bootstrap"[[:space:]]*:[[:space:]]*true' || fail "bootstrap-only switch must verify the selected bootstrap DNS"

strikes_file="$WORK_DIR/strikes.json"
rm -f "$strikes_file"
for strike in 1 2; do
  selected="$(FORKOP_DNS_FAILOVER_STRIKES=3 ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-failover.json" main 0 "$strikes_file")"
  printf '%s' "$selected" | grep -Eq '"index"[[:space:]]*:[[:space:]]*0' || fail "strike $strike must keep active DNS index 0"
  printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"debounce"' || fail "strike $strike must report debounce"
done
selected="$(FORKOP_DNS_FAILOVER_STRIKES=3 ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-recovery.json" main 0 "$strikes_file")"
printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"alive"' || fail "healthy active DNS must report alive"
selected="$(FORKOP_DNS_FAILOVER_STRIKES=3 ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-failover.json" main 0 "$strikes_file")"
printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"debounce"' || fail "healthy active DNS must reset strike counter"
FORKOP_DNS_FAILOVER_STRIKES=3 ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-failover.json" main 0 "$strikes_file" >/dev/null
selected="$(FORKOP_DNS_FAILOVER_STRIKES=3 ucode -L "$FORKOP_LIB" "$FAILOVER" select-fixture "$WORK_DIR/select-state.json" "$WORK_DIR/alive-failover.json" main 0 "$strikes_file")"
printf '%s' "$selected" | grep -Eq '"index"[[:space:]]*:[[:space:]]*1' || fail "third consecutive failure must switch to live backup"
printf '%s' "$selected" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"active_dead"' || fail "third strike must report active_dead"

mkdir -p "$WORK_DIR/mock-bin" "$WORK_DIR/proc/4242" "$WORK_DIR/run"
printf '4242 (sing-box) S 1 4242 4242 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 77777 0 0\n' >"$WORK_DIR/proc/4242/stat"
cat >"$WORK_DIR/mock-bin/ubus" <<'SH'
#!/bin/sh
printf '{"sing-box":{"instances":{"main":{"running":true,"pid":4242}}}}\n'
SH
cat >"$WORK_DIR/mock-bin/dig" <<SH
#!/bin/sh
printf 'probed\n' >>"$WORK_DIR/dig.log"
exit 1
SH
chmod +x "$WORK_DIR/mock-bin/ubus" "$WORK_DIR/mock-bin/dig"
cat >"$WORK_DIR/uci.state" <<'EOF'
forkop.settings=settings
forkop.settings.dns_type=udp
forkop.settings.dns_server=1.1.1.1 8.8.8.8
forkop.settings.bootstrap_dns_server=77.88.8.8
EOF
cat >"$WORK_DIR/run/dns-failover.json" <<'JSON'
{
  "version": 1,
  "dns_type": "udp",
  "dns_detour": "",
  "main_servers": [ "1.1.1.1", "8.8.8.8" ],
  "bootstrap_servers": [ "77.88.8.8" ],
  "main_index": 0,
  "bootstrap_index": 0
}
JSON

step_out="$(PATH="$WORK_DIR/mock-bin:$PATH" \
  FORKOP_UCI_STATE_FILE="$WORK_DIR/uci.state" \
  FORKOP_RUNTIME_STATE_DIR="$WORK_DIR/run" \
  FORKOP_DNS_FAILOVER_STATE_FILE="$WORK_DIR/run/dns-failover.json" \
  FORKOP_PROC_ROOT="$WORK_DIR/proc" \
  FORKOP_DNS_FAILOVER_GRACE_SECONDS=90 \
  ucode -L "$FORKOP_LIB" "$FAILOVER" step-fixture "$WORK_DIR/run/loop.json" 100)"
printf '%s' "$step_out" | grep -Eq '"reason"[[:space:]]*:[[:space:]]*"startup_grace"' || fail "startup grace window must skip DNS probes"
[ ! -e "$WORK_DIR/dig.log" ] || fail "dig must not run during sing-box startup grace window"

sleep 30 &
recycled_pid=$!
mkdir -p "$WORK_DIR/proc/$recycled_pid"
printf '%s (other) S 1 %s %s 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 99999 0 0\n' "$recycled_pid" "$recycled_pid" "$recycled_pid" >"$WORK_DIR/proc/$recycled_pid/stat"
printf '%s\n11111\n' "$recycled_pid" >"$WORK_DIR/run/dns-failover.pid"
FORKOP_RUNTIME_STATE_DIR="$WORK_DIR/run" \
  FORKOP_DNS_FAILOVER_PID_FILE="$WORK_DIR/run/dns-failover.pid" \
  FORKOP_PROC_ROOT="$WORK_DIR/proc" \
  ucode -L "$FORKOP_LIB" "$FAILOVER" stop-runtime
kill -0 "$recycled_pid" 2>/dev/null || fail "stop-runtime must not kill recycled PID when start_ticks differ"
kill "$recycled_pid" 2>/dev/null || true
wait "$recycled_pid" 2>/dev/null || true

printf 'DNS failover checks passed\n'
