# REALITY compatibility through Extended

User-approved direction: corrected sing-box is primary, retaining Extended;
Xray remains a reserve architecture, not an additional mandatory process.
Use TDD, test fresh and older Xray, then verify release packages. No live router
or VPS changes. Preserve namespaces, DNS isolation, IPv6 and TLS validation.

## Architecture decision

Prefer the existing upstream correction over maintaining another crypto fork:
shtorm-7/sing-box-extended already exposes
`tls.reality.support_x25519mlkem768`. Verify its official pinned stable binary
with our generator and real Xray endpoints before admitting this capability.
If the upstream mechanism fails the required tests, investigate and introduce
only the minimal source patch justified by the observed failure.

The alternative local Xray SOCKS adapter would add process supervision, UDP and
selector/statistics complexity; retain it as future reserve. TLS/Vision remains
a tested alternative, never an automatic replacement of REALITY settings.

## Generator and capability contract

Use one narrowly scoped shared capability adapter for tested Extended builds.
Generate the hybrid flag for REALITY on admitted versions and a verified Chrome
fingerprint profile; do not emit Extended-only schema for stock or unknown cores.
Allow explicit legacy opt-out for older servers. Preserve explicit user choices;
unsupported fingerprints yield actionable diagnostics rather than silent changes.
Handle manually configured and imported/subscription outbounds consistently.
Preflight requires the actual generated hybrid flag plus admitted runtime version
and fingerprint; a version label alone cannot certify a connection. Retain the
selected-section HTTPS probe and all existing transport/security restrictions.

## Extended preservation and updates

Retain the upstream Extended source/features, package identity and updater paths.
Pin release assets and SHA256 in the native test provisioner. Reuse existing
bounded installer staging/backup/rollback; do not silently replace Extended with
stock sing-box. Add update safeguards only where a reproduced test shows current
behavior would remove the working hybrid capability. No automatic installation.

## Acceptance evidence

Execute the actual Forkop generator and official Extended binary, not metadata
stubs, against Xray 26.10.21 and at least two older available official releases
(prefer 26.6.27 and 26.9.30). Preserve a hybrid-disabled current-Xray rejection
control and demonstrate generated hybrid-enabled success. Assert random HTTPS
payload, strict CA rejection, wrong UUID/public-key/short-ID rejection. Cover
Chrome and explicit legacy mode; unsupported fingerprints stay unconfirmed.
Check Extended-only schemas/features such as XHTTP without claiming their full
live protocol interoperability unless separately exercised.

Run all backend/shell/frontend gates, strict ucode compilation and six IPK/APK
builds; verify downloaded archive hashes and packaged runtime contents. Record
RED and GREEN commits, diagnostics and exact tested versions. No guarantee for
arbitrary future core versions or live Aeza conditions.
