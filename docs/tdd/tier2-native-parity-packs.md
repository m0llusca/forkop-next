# Tier-2 Native Architectural Parity Packs (Packs 1–5)

Base: `83639e824a1630100d4c53882ef3c70682d8aa51` (+ Phase 1/2 audit & security calibration).

This verification record documents the clean-room, GPL-2.0-or-later behavioral TDD
implementation of all five Tier-2 architectural feature packs across backend ucode
modules, native `sing-box` / `sing-box-extended` core adapters, `nftables` / policy
routing, frontend TypeScript (`fe-app-forkop`), native LuCI views (`luci-app-forkop`),
100% Russian localization, and user-space **ASUS TUF-AX4200 (OpenWrt 25.12.6)**
router emulation.

## Scope and boundaries

- All tests and router emulation use synthetic, RFC-5737 / RFC-3849 / RFC-5180
  documentation and benchmarking ranges (`198.51.100.0/24`, `203.0.113.0/24`,
  `192.168.1.0/24`, `2001:db8::/32`, `2001:2::/112`). No credentials, real
  subscriptions, private endpoints, or deployment backups are committed.
- TLS validation is strictly preserved (`--proto '=https' --proto-redir '=https'`,
  never `-k` / `--insecure`); DNS isolation and IPv6 protections remain fail-closed.
- Zero closed binaries (`podkop-engine`, `rust-x`), zero custom core fork lock-in,
  and zero GPL-3.0 code (`ByeByeDPI`) are imported.
- **Explicit non-claims (`AGENTS.md`)**:
  - Container user namespaces (`unshare -r`) are unavailable in this Linux sandbox,
    so `apk mkpkg` binary package creation remains verified in GitHub Actions CI.
  - User-space `nft` / `ip` / `ubus` shims validate generated rulesets, policy-routing
    invariants, and real `sing-box check` / `sing-box run` processes, but do **not**
    exercise physical MediaTek MT7986A hardware offloading or kernel `kmod-nft-tproxy`
    / `socket cgroupv2` packet traversal.
  - Per `AGENTS.md`, development fixtures and user-space emulation do **not** certify
    a live router installation; live deployment requires authorization, verified
    backups, and independent rollback.

## Behavioral TDD: RED → GREEN suites

### 1. Wave 1A — Network/DNS Resilience, Console TCP/UDP Split & P2P Bypass (`tests/backend/test_tier2_wave1a.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/backend/test_tier2_wave1a.py -v
```

Initial **RED**: **10 failed (`Ran 10 tests — FAILED`)**:

- `SB_FAKEIP_INET6_RANGE` / `FAKEIP_INET6_RANGE` still used ULA `fc00::/18` (triggering
  browser Local Network Access prompts and unbounded cache growth) instead of RFC 5180
  `2001:2::/112`; `singbox/country.uc` and `diagnostics/runtime.uc` misclassified
  `2001:2::/48` or hardcoded `^fc00:` regexes; `service/lifecycle.uc` lacked
  `/etc/forkop/fakeip6.range` migration tracking for `cache.db`.
- `nft/apply.uc` lacked `ip -4 rule add iif lo fwmark 0x4000000/0x4000000 lookup main priority 104`
  (`source-check-rule4-present`) for `src_valid_mark=1` coexistence with Tailscale /
  kernel WireGuard.
- `singbox/dns_failover.uc` lacked 90-second startup grace, 3-strike debounce, and
  `/proc/<pid>/stat` `start_ticks` PID identity verification; `singbox/priority.uc`
  lacked Pin Guard (3-strike runtime fallback from a dead manually-pinned node without
  mutating `/etc/forkop/selections.json`, auto-restoring on recovery).
- `nft/apply.uc`, `singbox/route.uc`, `service/route_explain.uc`, and `service/torrserver.uc`
  lacked `console_mode` non-FakeIP UDP `priority_rules` fast-path + FakeIP UDP `direct-out`
  split, `bittorrent_direct` (`protocol: "bittorrent"` -> `direct-out`), and isolated
  `table inet ForkopTorrServerDirect` (`priority -151` cgroupv2 bypass preserving FakeIP
  tracker announces).

Final **GREEN**: **10 passed (`10/10 OK`)**.

### 2. Wave 1B — Canonical `filter_identity`, Clash YAML Lists, TSPU Classifier & Dual-Core WG/AWG/WARP Modules (`tests/backend/test_filter_identity.py`, `tests/backend/test_clash_yaml_lists.py`, `tests/backend/test_tspu_classify.py`, `tests/backend/test_wireguard_modules.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/backend/test_filter_identity.py tests/backend/test_clash_yaml_lists.py tests/backend/test_tspu_classify.py tests/backend/test_wireguard_modules.py tests/backend/test_manual_selection.py -v
```

Initial **RED**: **18 failed / errored across the 4 new suites**:

- `singbox/filter_identity.uc` missing: `group_resolver.uc` matched only raw volatile
  display strings and lost membership when providers changed leading flags, counters,
  or bracket badges; `service/selection.uc` hashed only `outbounds[]` via subprocess
  and ignored `endpoints[]`.
- `routing/rulesets.uc` and `components/updates.uc` did not parse Clash `rule-provider`
  `payload:` / `rules:` YAML lists (`DOMAIN`, `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD`,
  `DOMAIN-REGEX`, `IP-CIDR`, `IP-CIDR6`) or separate `.yaml` cache filenames from `.lst`.
- `service/tspu_classify.uc` missing: no 4-stage (`dns` -> `tcp` -> `tls` -> `byte_cap`
  64 KiB range GET) classifier for 16–20 KiB TSPU byte-cap (`tspu_byte_cap_16kb`),
  `tls_hello_blocked`, `dns_spoofed`, `clock_skew`, or proxy bypass comparison.
- `singbox/amnezia.uc`, `singbox/wireguard.uc`, and `warp/register.uc` missing: no
  dual-core endpoint adapter validating against real `sing-box-1.13.7`, `sing-box-1.14.3`,
  and `sing-box-1.14.3-extended-2.7.3` binaries (including raw `+` / `/` Curve25519
  keys, native `type: "warp"` + 1-sided AmneziaWG on Extended, and automatic
  `type: "wireguard"` + `peers[0].reserved` fallback on stock `sing-box`).

Final **GREEN**: **22 passed (`22/22 OK`)**, including live `sing-box check -c` across
all 3 cached cores (`1.13.7`, `1.14.3`, `1.14.3-extended-2.7.3`) and local TLS mock
Cloudflare WARP registration.

### 3. Wave 2A — Shared Backend CLI, Subscription Preview, Shrink Guard & Validator Integration (`tests/backend/test_tier2_wave2_integration.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/backend/test_tier2_wave2_integration.py -v
```

Initial **RED**: **8 failed / errored (`Ran 8 tests in 0.122s — FAILED (failures=7, errors=1)`)**;
plus a dedicated seam RED → GREEN check on `editor_preview` `countries` (`dict` mapping
`serverName -> ISO-3166-1 alpha-2` for LuCI `section.js` country chips).

Implemented & verified:

- `/usr/bin/forkop` CLI registration (`editor_preview`, `tspu_classify`,
  `generate_warp_profile`) with `timeout 25` budget and no `dnsmasq` failsafe trigger
  on read/helper errors; unlocked `next tspu_classify` and `gaming_apply` `console`
  preset + `console_mode` persistence in `service/next.uc`.
- `<50%` subscription shrink guard (`old_count >= 4 && new_count * 2 < old_count`)
  recording `subscription_shrunk` in `subscription/evidence.uc` while preserving the
  last-good cached pool, `filter_identity` alias carry-forward (`__forkop_filter_id`,
  `__forkop_filter_names`), and isolated `0700` `subscription/editor.uc` preview with
  fail-closed `download_proxy_unavailable` and SSRF checks.
- End-to-end `config.endpoints` generation, `@timeserver` bootstrap DNS rules, section
  detour cascade (stripping `routing_mark` / `bind_interface` when `detour` is set),
  `store_warp_config: true`, `extended_preview.uc` credential redaction & scheme
  support, `config/validator.uc` rules, and `diagnostics/status.uc` secret masking.

Final **GREEN**: **8 passed (`Ran 8 tests — OK`)**.

### 4. Wave 2B — Frontend Validators, TSPU Diagnostics UI, Native LuCI Helpers & 100% RU Localization (`fe-app-forkop/src/forkop/workspace/tests/tier2FrontendAndValidators.test.ts`)

Command (from `fe-app-forkop`):

```text
pnpm exec vitest run src/forkop/workspace/tests/tier2FrontendAndValidators.test.ts
```

Initial **RED**: **11 failed (`11 failed | 1 passed`)**.

Implemented & verified:

- `validateWireGuardUrl.ts`, `validateProxyUrl.ts`, `validateOutboundJson.ts`,
  `isCopyableProxyLink.ts`, and `maskDiagnostics.ts` supporting `wireguard://`, `wg://`,
  `awg://`, `amneziawg://`, `warp://`, JSON `wireguard`/`warp` endpoints, and raw `+`/`/`
  Curve25519 keys while preserving `2001:2::/48` FakeIPv6 unredacted.
- Interactive 4-stage TSPU classifier UI in `symptomGuide.ts` + `next/api.ts`
  (`tspuClassify`), `console` gaming preset + `console_mode` toggle in `next/tools.ts`,
  and `bittorrent` / `stun` / `console_udp_direct` trace labels in `next/advanced.ts`.
- Native LuCI `section.js` (`_subscription_preview`, `_wg_warp_helper` `.conf` INI
  import + 1-sided AWG + Cloudflare WARP generator, `console_mode`, Clash `.yaml`/`.yml`
  list validation) and `settings.js` (`bittorrent_direct`, `torrserver_direct`).
- Full Russian localization (`872 / 872` translated entries, `0` untranslated, `0` fuzzy).

Final **GREEN**: **13 passed (`13/13`)** in `tier2FrontendAndValidators.test.ts`;
**93 / 93 files, 950 / 950 tests passed** across full Frontend CI.

### 5. Extended ASUS TUF-AX4200 (OpenWrt 25.12.6) Emulation (`tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py -v
```

Final **GREEN**: **2 passed (`Ran 2 tests in 3.885s — OK`)**, verifying both the base
router lifecycle (including live `sing-box run` Clash API + `nftables` `fib daddr type local`)
and all Tier-2 features on the emulated TUF-AX4200 (`2001:2::/112` FakeIPv6,
`0.openwrt.pool.ntp.org` bootstrap DNS, compiled Clash YAML `steam_yaml-lists-ruleset`,
`bittorrent_direct`, PS5 `console_mode` TCP/UDP/STUN `route_explain` parity, native
AmneziaWG + Cloudflare WARP `endpoints[]` validated via real `sing-box-1.14.3-extended-2.7.3`
`check`, and WARP/AWG secret masking).

## Full verification gates

All gates executed with exit code `0`:

```text
(cd fe-app-forkop && pnpm run locales:actualize && pnpm run format:js && pnpm run format && pnpm run ci)
FORKOP_REQUIRE_CURRENT_CORES=1 FORKOP_TEST_CORES_DIR="$HOME/.cache/forkop-dev/forkop-cores" PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" bash tests/run-backend.sh
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py -v
node tests/emulation/luci_mobile_chromium_audit.mjs
"$HOME/.cache/forkop-dev/openwrt-luci/modules/luci-base/src/po2lmo" luci-app-forkop/po/ru/forkop.po /tmp/forkop-verify.lmo && rm -f /tmp/forkop-verify.lmo
git diff --check
```

Verified totals:

- Backend shell suites: **84 / 84 passed**.
- Backend Python `unittest` discovery: **332 / 332 passed** (`0` failures, `0` errors, `0` skipped with `FORKOP_REQUIRE_CURRENT_CORES=1`).
- ASUS TUF-AX4200 OpenWrt 25.12.6 router emulation: **2 / 2 passed**.
- Frontend CI (`prettier --check`, `eslint --max-warnings=0`, `vitest --run`, `tsc --noEmit`, `tsup`, `check-luci-bundle.mjs`): **93 / 93 files, 950 / 950 tests passed**.
- Localization catalog (`locales:actualize`, `luci_localization.sh`, `po2lmo`): **872 / 872 Russian strings translated (`100%`)**, byte-identical source & package PO files.
- Headless Chromium responsive LuCI audit: **9 / 9 viewports passed (`320x568`..`1440x900`, `0` issues)**.
