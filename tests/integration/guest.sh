#!/bin/sh
# This script runs ONLY inside the disposable QEMU guest, using real OpenWrt services.
set -eu
PAYLOAD=/root/integration
EVIDENCE=/tmp/integration-evidence
mkdir -p "$EVIDENCE"
fail() { echo "FAIL: $*" >&2; exit 1; }
stage() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$EVIDENCE/stages.log"; }
boot_unchanged() {
    cmp -s "$EVIDENCE/boot-id" /proc/sys/kernel/random/boot_id || fail 'guest rebooted'
    [ "$(cat /proc/1/comm)" = procd ] || fail 'PID 1 is not procd'
}
diagnostics() {
    date -u
    cat /proc/sys/kernel/random/boot_id /proc/uptime /proc/meminfo
    ubus call service list '{"name":"forkop"}' || true
    ubus call service list '{"name":"sing-box"}' || true
    for proc in /proc/[0-9]*; do
        [ -r "$proc/status" ] || continue
        awk '/^(Name|Pid|PPid|VmRSS|VmPeak|Threads):/ {printf "%s ", $0} END {print ""}' "$proc/status" 2>/dev/null || true
        tr '\000' ' ' < "$proc/cmdline" 2>/dev/null || true
        echo
    done
    logread | tail -160
    dmesg | tail -80
}
sampler() {
    # Disk use is bounded to the final 120 snapshots, at 2-second intervals.
    n=0
    while [ "$n" -lt 120 ]; do
        diagnostics > "$EVIDENCE/process-$n.log" 2>&1
        n=$((n + 1))
        sleep 2
    done
}
running() {
    /etc/init.d/forkop status
    pidof sing-box >/dev/null || fail 'real sing-box process missing'
    ubus call service list '{"name":"forkop"}' > "$EVIDENCE/procd-current.json"
    ucode -e 'let s=json(require("fs").readfile(ARGV[0])); let i=s.forkop && s.forkop.instances && s.forkop.instances["next-expiry"]; exit(i && i.running && i.pid > 1 ? 0 : 1);' \
        "$EVIDENCE/procd-current.json" || fail 'next-expiry absent/not running in real procd'
}
dns_state() { uci export dhcp | sha256sum | cut -d' ' -f1; }
fakeip() {
    result=$(dig +time=2 +tries=1 +short @127.0.0.42 "$1" A)
    case "$result" in 198.18.*|198.19.*) printf '%s\n' "$result";; *) fail "No FakeIP for $1: $result";; esac
}
warm() {
    fakeip first.integration.invalid > "$EVIDENCE/first.ip"
    fakeip second.integration.invalid > "$EVIDENCE/second.ip"
    [ "$(cat "$EVIDENCE/first.ip")" != "$(cat "$EVIDENCE/second.ip")" ] || fail 'FakeIP test domains collide'
}
warm_preserved() {
    # Reverse lookup order catches a reset allocator that would reproduce the first address.
    [ "$(fakeip second.integration.invalid)" = "$(cat "$EVIDENCE/second.ip")" ] || fail 'second warm FakeIP changed'
    [ "$(fakeip first.integration.invalid)" = "$(cat "$EVIDENCE/first.ip")" ] || fail 'first warm FakeIP changed'
}

case "${1:-}" in
diagnostics) diagnostics; exit 0;;
setup)
    stage 'setup: real PID1, kernel, package manager'
    [ "$(cat /proc/1/comm)" = procd ] || fail 'requires booted OpenWrt, not a chroot'
    cat /proc/sys/kernel/random/boot_id > "$EVIDENCE/boot-id"
    cat /etc/openwrt_release
    apk --version
    apk update
    # Dependencies are installed by apk with signed official OpenWrt repository indexes.
    # OpenWrt authenticates these packages through its signed repository index;
    # a standalone local APK does not carry that repository trust context.
    apk add 'sing-box=1.13.21-r1'
    apk list --installed sing-box | tee "$EVIDENCE/core-package.txt"
    apk info --exists 'sing-box=1.13.21-r1' >/dev/null || fail 'wrong installed core package'
    apk add --allow-untrusted "$PAYLOAD/forkop_1.2.0.apk"
    /etc/init.d/forkop disable
    /etc/init.d/sing-box stop || true
    /usr/bin/sing-box version | tee "$EVIDENCE/core-version.txt"
    sha256sum /usr/bin/sing-box | tee "$EVIDENCE/core-binary.sha256"
    # Exact generic adapter used for compatibility; no installed configuration is copied.
    (cd / && sha256sum -c "$PAYLOAD/adapter/SHA256SUMS.before")
    (cd "$PAYLOAD/adapter" && sha256sum -c SHA256SUMS)
    cp -a "$PAYLOAD/adapter/etc/." /etc/
    cp -a "$PAYLOAD/adapter/usr/." /usr/
    chmod 755 /usr/bin/forkop /etc/init.d/forkop
    uci set forkop.settings.list_update_enabled='0'
    uci set forkop.settings.component_update_check_enabled='0'
    uci set forkop.settings.enable_yacd='1'
    uci set forkop.settings.dont_touch_dhcp='0'
    uci -q delete forkop.settings.dns_server || true
    uci add_list forkop.settings.dns_server='10.0.2.3'
    uci -q delete forkop.settings.bootstrap_dns_server || true
    uci add_list forkop.settings.bootstrap_dns_server='10.0.2.3'
    uci set forkop.integration=section
    uci set forkop.integration.enabled='1'
    uci set forkop.integration.action='connection'
    uci add_list forkop.integration.outbound_jsons='{"type":"direct","tag":"Integration direct"}'
    uci add_list forkop.integration.domain_suffix='integration.invalid'
    uci commit forkop
    stage 'setup: start legacy payload with five-file adapter'
    /etc/init.d/forkop start
    running
    warm
    stage 'setup: real snapshot and deterministic maintenance handoff'
    /usr/bin/forkop maintenance_snapshot > "$EVIDENCE/snapshot.json"
    before=$(dns_state)
    /usr/bin/forkop package_prerm upgrade
    [ -f /tmp/forkop-package-was-running ] || fail 'handoff not created'
    [ "$before" = "$(dns_state)" ] || fail 'DNS restored during maintenance stop'
    if pidof sing-box >/dev/null; then fail 'maintenance stop left core running'; fi
    [ -s /tmp/sing-box/cache.db ] || fail 'warm cache removed during maintenance'
    /usr/bin/forkop package_postinst
    running
    warm_preserved
    boot_unchanged
    stage 'PASS setup and explicit real maintenance cycle'
    ;;
upgrade)
    boot_unchanged
    running
    warm
    stage 'upgrade: actual apk pre-upgrade, replacement, post-upgrade'
    sampler &
    sample_pid=$!
    trap 'kill "$sample_pid" 2>/dev/null || true' EXIT
    apk add --allow-untrusted --upgrade "$PAYLOAD/forkop_1.2.1-r2.apk"
    kill "$sample_pid" 2>/dev/null || true
    wait "$sample_pid" 2>/dev/null || true
    trap - EXIT
    apk list --installed forkop | tee "$EVIDENCE/package-after.txt"
    apk info --exists 'forkop=1.2.1-r2' >/dev/null || fail 'wrong installed package version'
    [ ! -e /tmp/forkop-package-was-running ] || fail 'postinst did not consume handoff'
    running
    warm_preserved
    boot_unchanged
    stage 'upgrade: restart through stock rc.common/procd'
    /etc/init.d/forkop restart
    running
    warm_preserved
    boot_unchanged
    stage 'PASS actual APK upgrade and restart'
    ;;
boundaries)
    stage 'boundaries: snapshot handoff persistence failure must abort before stop'
    running
    original_pid=$(pidof sing-box)
    before=$(dns_state)
    # A real nonexistent parent makes the actual exclusive marker write fail.
    if FORKOP_PACKAGE_UPGRADE_STATE=/nonexistent-integration-parent/marker /usr/bin/forkop package_prerm upgrade; then
        fail 'prerm ignored handoff write failure'
    fi
    [ "$original_pid" = "$(pidof sing-box)" ] || fail 'handoff failure stopped/replaced live core'
    [ "$before" = "$(dns_state)" ] || fail 'handoff failure changed DNS'
    running
    stage 'boundaries: invalid configuration must propagate actual start failure'
    /usr/bin/forkop package_prerm upgrade
    uci set forkop.settings.dns_type='integration-invalid'
    uci commit forkop
    if /usr/bin/forkop package_postinst; then fail 'invalid config start unexpectedly succeeded'; fi
    if pidof sing-box >/dev/null; then fail 'failed resume left core running'; fi
    # Failsafe must remove forwarding to the stopped core; upstream DNS remains available.
    case "$(uci -q get dhcp.@dnsmasq[0].server || true)" in
        *127.0.0.42*) fail 'failed resume left dnsmasq forwarding to stopped core';;
    esac
    uci set forkop.settings.dns_type='udp'
    uci commit forkop
    /usr/bin/forkop package_postinst
    running
    boot_unchanged
    stage 'PASS failure boundaries and recovery'
    ;;
*) fail 'Expected setup, upgrade, boundaries or diagnostics';;
esac
