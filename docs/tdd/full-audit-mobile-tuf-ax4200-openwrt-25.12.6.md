# Full Security, Consistency & Mobile Responsiveness Audit + ASUS TUF-AX4200 (OpenWrt 25.12.6) Emulation

Base: `83639e824a1630100d4c53882ef3c70682d8aa51`.

This verification record documents the repository-wide security, runtime consistency,
localization, and mobile/tablet/desktop responsive UI audit, together with user-space
router emulation for **ASUS TUF-AX4200** (`asus,tuf-ax4200`, `mediatek/filogic` /
`aarch64_cortex-a53`) running **OpenWrt 25.12.6** (`apk`-based rootfs, `fw4` /
`nftables`, `dnsmasq` `confdir`, `procd` / `ubus`, LuCI Bootstrap theme).

## Scope and boundaries

- All tests and router emulation run with synthetic, non-routable / documentation-range
  fixtures only (`198.51.100.0/24`, `192.168.50.0/24`, `fd42:4200:2512::/64`,
  `example.com`). No real deployment credentials, endpoint addresses, or backups
  are used or recorded.
- User-space emulation exercises real compiled OpenWrt `libuci` (`uci`), `libubox`,
  `json-c`, `ucode`, official SHA256-pinned `sing-box` cores, OpenWrt 25.12.6 LuCI
  `cascade.css` / `mobile.css` + `po2lmo`, and headless Chromium CDP across 9 viewports
  (`320x568` through `1440x900`).
- **Explicit non-claims (`AGENTS.md`)**:
  - Container user namespaces (`unshare -r`) are unavailable in this Linux sandbox, so
    `apk mkpkg` binary package creation (`build.sh` APK packaging step) cannot execute
    locally and remains gated by GitHub Actions CI.
  - User-space `nft` / `ip` / `ubus` shims validate generated rulesets, mark/table
    invariants, and procd/dnsmasq state transitions, but do **not** exercise physical
    MediaTek MT7986A hardware offloading, kernel `kmod-nft-tproxy` / `NFQUEUE` packet
    traversal, or Wi-Fi drivers.
  - Per `AGENTS.md`, user-space emulation and development fixtures do **not** certify a
    live router installation; live deployment requires explicit authorization, verified
    backups, and independent rollback.

## Behavioral TDD: RED → GREEN suites

### 1. Backend security, validation & OpenWrt 25.12.6 compatibility (`tests/backend/test_audit_security_and_compat.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/backend/test_audit_security_and_compat.py -v
```

Initial **RED**: **14 failed / errored (`Ran 14 tests`)**:

- `SEC-01`: Subscription parser/generator accepted arbitrary outbound fields (`inet_bind_address`, `routing_mark`, `detour`, local `certificate_path` / `key_path`) and loopback/link-local/unspecified/multicast target servers in live UCI generation.
- `SEC-02`: `providers/nfqueue/validator.uc` and `providers/byedpi/validator.uc` allowed local file-reading flags (`--hosts`, `--ipset`, `@file`, `--tlsrec=@file`, etc.), and `core/uci.uc` `set_option` / `set_list` lacked section/option identifier validation.
- `SEC-03`: `components/updater.uc`, `components/updates.uc`, `singbox/subscription.uc`, and `install.sh` lacked strict HTTPS redirect enforcement (`--proto '=https' --proto-redir '=https'`) and origin allowlisting on release download URLs; `install.sh` wrote predictable `/tmp` paths instead of `mktemp`.
- `SEC-04`: `diagnostics/status.uc` did not redact `vless://`, `trojan://`, `ss://`, `hy2://`, `hysteria2://`, `socks5://`, `tuic://` credentials or `yacd_secret_key` / `Authorization` / `password=` tokens in diagnostic log excerpts, and `nft/apply.uc` used a predictable `/tmp/forkop-nft.rules` path.
- `BUG-01..BUG-10`: `config/validator.uc` allowed normalized `cache_path` traversal (`/../cache.db`) and zero-duration `0s` intervals; IPv6 Clash API controller addresses (`fd00::1`) were formatted without brackets (`fd00::1:9090`); `outbound_tag("direct")` collided or broke route/explain parity; `subscription/cache.uc` could poison cached state on truncated writes without atomic temp+rename; `service/compatibility.uc` and `components/action.uc` did not detect OpenWrt 25.12+ `apk` (`apk info -e`) alongside `opkg`.

Final **GREEN**: **14 passed (`Ran 14 tests in 0.659s — OK`)**.

### 2. ASUS TUF-AX4200 + OpenWrt 25.12.6 user-space router emulation (`tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py`)

Command:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py -v
```

Emulated profile:

- Board: `asus,tuf-ax4200` (`ASUS TUF-AX4200`, `mediatek/filogic`, `aarch64_cortex-a53`, OpenWrt `25.12.6`, `apk-tools` `3.0.0_pre202602`, `sing-box` `1.13.12-extended`, `zapret2` `0.9.5`, `byedpi` `0.17.3`).
- Network topology: dual-stack `br-lan` (`192.168.50.1/24`, `fd42:4200:2512::1/60`), `br-guest` (`192.168.52.1/24`), PPPoE WAN (`pppoe-wan`), IPv6 WAN6 (`wan6`), LAN clients (`192.168.50.10`, `192.168.50.25`, `192.168.50.40`).

Initial **RED**: Failed on `apk`-only package detection (`opkg` absent on OpenWrt 25.12.6), unbracketed IPv6 Clash controller literal (`[fd42:4200:2512::1]:9090`), and live subscription loopback SSRF guard.

Final **GREEN**: **1 passed (`Ran 1 test in 3.387s — OK`)**, verifying compatibility preflight, `generate-config` against real `libuci` + `sing-box check`, atomic `nft -f` table generation (including `fib daddr type local return`), `dnsmasq` `confdir` provisioning, `route_explain` parity across proxy/direct/device-pinned rules, diagnostic secret redaction, and clean service teardown.

### 3. Frontend security, LuCI state integrity & validator localization (`fe-app-forkop/src/forkop/workspace/tests/auditSecurityAndBugs.test.ts`)

Command (from `fe-app-forkop`):

```text
pnpm test --run src/forkop/workspace/tests/auditSecurityAndBugs.test.ts
```

Initial **RED**: **12 failed (`0 passed`)**:

- Unvalidated `release_url` protocol before `window.open` in `tabs/updates/initController.ts`.
- Infinite wait loop on failed `forkop` self-update when backend job exited without version match, plus non-extracted `translate('Forkop has been installed')` wrapper in `methods/shell/index.ts`.
- Missing `"removes"` bucket check in `localChanges()` and missing `nativeDirty` refresh inside `forkopMap.renderContents` in `luci-app-forkop/.../forkop.js`.
- Child UCI section leaks (`urltest`, `priority_group`, `priority_level`, `subscription_url`, `section_interface`) when canceling parent rule modal in `luci-app-forkop/.../section.js`, plus stale `outboundNameChoicesCache` / `extendedPreviewBaselines` across reloads.
- `validatePath` allowing `..` / `.` segments, `parseQueryString` dropping empty keys and `+` decoding, `getClashApiUrl` failing to bracket IPv6 host literals, `maskDiagnostics` missing proxy URI credential & IPv6 ULA redaction, `extendedPreview` leaving `aria-busy="true"` on early invalidation/errors, `monitoring` tab activation mismatch under native LuCI `data-tab`, `getDashboardSections` ignoring legacy `connection_type`, and unwrapped English strings across URL validators and `renderSections.ts`.

Final **GREEN**: **12 passed (`12/12`)**; full frontend suite **92 files, 930 tests passed**.

### 4. Real Chromium 9-viewport mobile/tablet/desktop LuCI audit (`tests/emulation/luci_mobile_chromium_audit.mjs`)

Command:

```text
node tests/emulation/luci_mobile_chromium_audit.mjs
```

Viewports audited against OpenWrt 25.12.6 `cascade.css` + `mobile.css` + built `main.js`:
`320x568`, `360x800`, `375x812`, `390x844`, `412x915`, `720x1024`, `900x1024`, `1050x800`, `1440x900`.

Initial **RED**: **32 responsive layout & accessibility defects across viewports**, including:

- `.modal.fkp-workspace-modal` overflowing narrow viewports by `+16px` (`336px` on `320px`) because LuCI Bootstrap `.modal` uses `box-sizing: content-box` with `1em` horizontal padding while `workspace/styles.ts` only applied `border-box` to descendants (`.fkp-workspace-modal *`).
- `.fkp_dashboard-page__urltest-details__table { width: calc(100% + 14px) }` overflowing its modal container across viewports.
- `.fkp_monitoring-page__table { min-width: 840px }` causing horizontal overflow at `1050x800` alongside the workspace sidebar, and `td.fkp_monitoring-page__state-cell` failing to stack cleanly at `<= 900px`.
- `.fkp_updates-page` `min-width: max-content` forcing horizontal overflow on narrow mobile screens (`320px–412px`).
- Sub-`42px` interactive controls (`20px–36px`) on dashboard copy/latency/update buttons, monitoring filter/row-close buttons, modal footers, and mobile `.fkp-connections-dynlist` action overlap.
- `.toast-container` fixed width / offset clipping on `320px` viewports and missing `@media (prefers-reduced-motion: reduce)` guards on `.rotate`, `.skeleton::after`, and `.toast`.
- `.fkp-workspace` desktop `overflow: clip` breaking `position: sticky` on `.fkp-workspace-nav` at `>= 1200px`.

Final **GREEN**: **All 9 viewports passed (`0` issues across `320x568`..`1440x900`)**, while preserving `visualSystem.test.ts` (`42px` standard `.cbi-value` controls, `>= 44px` navigation/disclosures) and `luci_dynamiclist_layout.sh`.

### 5. Security boundary calibration & ecosystem parity fixes (`tests/backend/test_audit_security_and_compat.py`, `tests/backend/test_extended_preview.py`, `tests/nft_apply.sh`, `fe-app-forkop/src/validators/tests/validateOutboundJson.test.js`)

Commands:

```text
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/backend/test_audit_security_and_compat.py tests/backend/test_extended_preview.py -v
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" bash tests/nft_apply.sh
(cd fe-app-forkop && pnpm exec vitest run src/validators/tests/validateOutboundJson.test.js)
```

Initial **RED**:

- `CALIB-01`: `providers/nfqueue/validator.uc` rejected custom `nfqws2` Lua desync helper scripts inside `/opt/zapret2/lua/` (`--lua-init=@/opt/zapret2/lua/custom-youtube.lua`, `--lua-init @/opt/zapret2/lua/helper_v2.lua.gz`).
- `CALIB-02`: `subscription/parser.uc`, `subscription/share_link.uc`, and `singbox/generator.uc` did not normalize SIP002 / Clash `simple-obfs` and `obfs` aliases to `sing-box`'s supported `obfs-local` SIP003 plugin name or assemble Clash `plugin-opts` (`mode`, `host`, `tls`, `path`, `mux`), while empirical `sing-box check` (`1.13.7`, `1.14.3`, `1.14.3-extended-2.7.3`) confirmed `sing-box` fatal-exits on unnormalized `simple-obfs`.
- `PARITY-01`: Manual `hy2://` / `hysteria2://` links, Clash YAML `ports:` / `mport:`, and `validateOutboundJson.ts` rejected Hysteria2 port-hopping ranges (`server_ports: ["20000:40000", "50000:50000"]`); premature whole-link `url_decode` in `singbox/generator.uc` (`manual_link_outbound`, `manual_shadowsocks_outbound`) and `service/extended_preview.uc` (`source_url`) truncated `%40` / `%3F` passwords (`hy2://p%40ss%3Fword@...` -> `'p'`) and `%26` transport query paths; `core/url.uc` `authority()` searched `@` before stripping `?` / `#`; `add_urltest_outbound` emitted `tolerance: 0` (which `sing-box` resets to `50ms`) instead of clamping explicit `0` to `1ms`.
- `PARITY-02`: `nft/apply.uc` (`nft_create_runtime_base`) inserted `udp dport 123 return` only in `mangle` and omitted `mangle_output` when `exclude_ntp` was enabled, leaving router `sysntpd` traffic captured before clock synchronization.

Final **GREEN**: **`test_audit_security_and_compat.py` (18/18 passed), `test_extended_preview.py` (16/16 passed including `%40`/`%3F` credential redaction parity), `nft_apply.sh` (PASS), `validateOutboundJson.test.js` (13/13 passed)**.

## Full verification gates

All commands executed cleanly with exit code `0`:

```text
FORKOP_REQUIRE_CURRENT_CORES=1 PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" bash tests/run-backend.sh
PATH="$HOME/.local/bin:$PATH" LD_LIBRARY_PATH="$HOME/.local/lib:$HOME/.local/lib64:${LD_LIBRARY_PATH:-}" python3 -m unittest tests/emulation/asus_tuf_ax4200_openwrt_25_12_6.py -v
(cd fe-app-forkop && pnpm run ci)
node tests/emulation/luci_mobile_chromium_audit.mjs
node --check luci-app-forkop/htdocs/luci-static/resources/view/forkop/*.js
/tmp/openwrt-luci/modules/luci-base/src/po2lmo luci-app-forkop/po/ru/forkop.po /tmp/forkop-verify.lmo && rm -f /tmp/forkop-verify.lmo
git diff --check
```

Verified totals:

- Backend shell suites: **84 / 84 passed**.
- Backend Python `unittest` discovery: **290 / 290 passed** (0 skipped).
- ASUS TUF-AX4200 OpenWrt 25.12.6 emulation: **1 / 1 passed**.
- Frontend CI (`prettier --check`, `eslint --max-warnings=0`, `vitest --run`, `tsc --noEmit`, `tsup`, `check-luci-bundle.mjs`): **92 / 92 files, 932 / 932 tests passed**.
- Localization catalog (`locales:actualize`, `luci_localization.sh`, `po2lmo`): **797 / 797 Russian strings translated**, POT/PO headers preserved, source and package PO files byte-identical.
- Headless Chromium responsive LuCI audit: **9 / 9 viewports passed (`320x568`..`1440x900`)**.
