#!/bin/sh
# Native ucode fixture: all network/service commands are replaced before use.
set -eu
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FORKOP_LIB="$ROOT_DIR/forkop/files/usr/lib"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
export FORKOP_LIB
export FORKOP_UCI_STATE_FILE="$WORK_DIR/uci.state"
export NFT_LOG="$WORK_DIR/nft.log"
mkdir "$WORK_DIR/bin"
cat > "$WORK_DIR/bin/nft" <<'MOCK'
#!/bin/sh
printf '%s\n' "$*" >> "$NFT_LOG"
MOCK
cat > "$WORK_DIR/bin/logger" <<'MOCK'
#!/bin/sh
exit 0
MOCK
for command in ip sysctl service ubus uci; do
    printf '#!/bin/sh\nprintf "Unexpected external command\\n" >&2\nexit 99\n' > "$WORK_DIR/bin/$command"
done
chmod +x "$WORK_DIR/bin/"*
export PATH="$WORK_DIR/bin:$PATH"
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
nft_apply() { ucode -L "$FORKOP_LIB" "$FORKOP_LIB/nft/apply.uc" "$@"; }
base() {
    nft_apply nft-create-runtime-base-from-uci ForkopTable localv4 forkop_subnets forkop_ports forkop_ip_ports forkop_interfaces 0x00100000 0x00200000 198.18.0.0/15 1602
}
contains() { grep -Fq "$2" "$1" || fail "$3"; }
before() {
    first="$(grep -Fn "$1" "$NFT_LOG" | head -n 1 | cut -d: -f1)"
    second="$(grep -Fn "$2" "$NFT_LOG" | head -n 1 | cut -d: -f1)"
    [ -n "$first" ] && [ -n "$second" ] && [ "$first" -lt "$second" ] || fail "$3"
}
printf 'forkop.settings=settings\nforkop.settings.source_network_interfaces=br-lan\n' > "$FORKOP_UCI_STATE_FILE"
: > "$NFT_LOG"
base
cp "$NFT_LOG" "$WORK_DIR/default.log"
: > "$NFT_LOG"
nft_apply nft-create-runtime-base ForkopTable localv4 forkop_subnets forkop_ports forkop_ip_ports forkop_interfaces br-lan 0x00100000 0x00200000 198.18.0.0/15 1602 0
cmp "$NFT_LOG" "$WORK_DIR/default.log" || fail 'original CLI arity must keep HTTPS capture off'
printf 'forkop.settings.https_domain_routing=0\n' >> "$FORKOP_UCI_STATE_FILE"
: > "$NFT_LOG"
base
cmp "$NFT_LOG" "$WORK_DIR/default.log" || fail 'omitted flag must equal explicit off'
printf 'forkop.settings=settings\nforkop.settings.source_network_interfaces=br-lan\nforkop.settings.https_domain_routing=1\n' > "$FORKOP_UCI_STATE_FILE"
: > "$NFT_LOG"
base
capture='add rule inet ForkopTable mangle iifname @forkop_interfaces tcp dport 443 meta mark set 0x00100000 counter'
contains "$NFT_LOG" "$capture" 'enabled LAN TCP443 capture is missing'
before 'mangle ct status dnat return' "$capture" 'DNAT guard must precede HTTPS capture'
before 'mangle iifname @forkop_interfaces ip daddr @localv4 return' "$capture" 'IPv4 local guard must precede HTTPS capture'
before 'mangle iifname @forkop_interfaces ip6 daddr @localv6 ip6 daddr != fc00::/18 return' "$capture" 'IPv6 local guard must precede HTTPS capture'
before 'mangle jump priority_rules' "$capture" 'explicit priority rules must precede HTTPS capture'
cp "$NFT_LOG" "$WORK_DIR/enabled.log"
: > "$NFT_LOG"
nft_apply nft-create-runtime-base ForkopTable localv4 forkop_subnets forkop_ports forkop_ip_ports forkop_interfaces br-lan 0x00100000 0x00200000 198.18.0.0/15 1602 0 localv6 forkop_subnets6 forkop_ip6_ports fc00::/18 ::1 1
cmp "$NFT_LOG" "$WORK_DIR/enabled.log" || fail 'optional trailing CLI flag must match enabled UCI behavior'
# Exactly one inet rule is added: no family restriction, UDP, other ports or output changes.
grep -Fvx "$capture" "$NFT_LOG" > "$WORK_DIR/without-capture.log"
cmp "$WORK_DIR/default.log" "$WORK_DIR/without-capture.log" || fail 'enabled mode changed unrelated runtime rules'
contains "$NFT_LOG" 'proxy meta mark & 0x00100000 == 0x00100000 meta l4proto tcp tproxy ip to :1602 counter' 'existing IPv4 tproxy consumer missing'
contains "$NFT_LOG" 'proxy meta mark & 0x00100000 == 0x00100000 meta l4proto tcp tproxy ip6 to [::1]:1602 counter' 'existing IPv6 tproxy consumer missing'
cat > "$WORK_DIR/priority.json" <<'JSON'
{"section":[{".name":"bypass","enabled":"1","action":"bypass","ip_cidr":["192.0.2.10","2001:db8::10"]}]}
JSON
nft_apply nft-add-section-priority-rules-fixture "$WORK_DIR/priority.json" ForkopTable forkop_interfaces localv4 localv6 0x00100000
contains "$NFT_LOG" 'priority_rules iifname @forkop_interfaces ip daddr != @localv4 ip daddr @forkop_rule_bypass_subnets counter accept' 'IPv4 bypass must terminate before capture'
contains "$NFT_LOG" 'priority_rules iifname @forkop_interfaces ip6 daddr != @localv6 ip6 daddr @forkop_rule_bypass_subnets6 counter accept' 'IPv6 bypass must terminate before capture'
for value in absent 0 1; do
    if [ "$value" = absent ]; then
        printf '{}\n' > "$WORK_DIR/$value.json"
    else
        printf '{"settings":{"https_domain_routing":"%s"}}\n' "$value" > "$WORK_DIR/$value.json"
    fi
    nft_apply nft-runtime-signature-fixture "$WORK_DIR/$value.json" > "$WORK_DIR/apply-$value"
    ucode -L "$FORKOP_LIB" "$FORKOP_LIB/service/state.uc" nft-signature-fixture "$WORK_DIR/$value.json" > "$WORK_DIR/state-$value"
    cmp "$WORK_DIR/apply-$value" "$WORK_DIR/state-$value" || fail 'apply and reload nft signatures disagree'
done
cmp "$WORK_DIR/apply-absent" "$WORK_DIR/apply-0" || fail 'absent and off signatures differ'
if cmp -s "$WORK_DIR/apply-0" "$WORK_DIR/apply-1"; then fail 'flag toggle must change nft reload fingerprint'; fi
for value in absent 0 1 invalid list; do
    case "$value" in
        absent) setting='' ;;
        list) setting='"https_domain_routing":["1"],' ;;
        *) setting="\"https_domain_routing\":\"$value\"," ;;
    esac
    printf '{"settings":{%s"dns_server":["192.0.2.53"],"bootstrap_dns_server":["192.0.2.53"]}}\n' "$setting" > "$WORK_DIR/validate.json"
    if ucode -L "$FORKOP_LIB" "$FORKOP_LIB/config/validator.uc" validate-runtime-fixture "$WORK_DIR/validate.json" '{}' > "$WORK_DIR/validation.log" 2>&1; then
        case "$value" in invalid|list) fail "accepted invalid boolean $value" ;; esac
    else
        case "$value" in
            invalid|list) contains "$WORK_DIR/validation.log" 'settings.https_domain_routing' 'boolean rejection must identify setting' ;;
            *) cat "$WORK_DIR/validation.log" >&2; fail "rejected valid boolean $value" ;;
        esac
    fi
done
printf 'HTTPS domain routing checks passed\n'
