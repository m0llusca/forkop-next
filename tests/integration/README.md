# Disposable OpenWrt maintenance integration

Run the **OpenWrt maintenance integration** workflow manually. Its sole automatic
trigger is the temporary `test/maintenance-upgrade-integration` branch, allowing
the first run before the workflow reaches the default branch.

The test boots the official OpenWrt 25.12.6 x86/64 kernel and ext4 root filesystem
under QEMU, with **512 MiB RAM**, two virtual CPUs, a disposable 768 MiB disk,
real PID 1 `procd`, stock `rc.common` and `procd.sh`, and the actual APK manager.
Networking uses QEMU user networking and loopback-only SSH forwarding. No router
address, router credentials, deployment archive, or user configuration is used.

`prepare.py` pins official OpenWrt image SHA256 values and GitHub release asset
digests. The pins were checked against:

- https://downloads.openwrt.org/releases/25.12.6/targets/x86/64/sha256sums
- https://api.github.com/repos/m0llusca/forkop-next/releases/tags/1.2.0
- https://api.github.com/repos/m0llusca/forkop-next/releases/tags/1.2.1-r2

The native musl sing-box **1.13.21-r1** package and its real init service come from
the [official OpenWrt x86_64 feed](https://downloads.openwrt.org/releases/packages-25.12/x86_64/packages/sing-box-1.13.21-r1.apk).
Its SHA256, computed from that official HTTPS artifact on 2026-10-25, is
`afba690111db21f4f6650ce38b0a1af2711bec311cf51642861dc92c4256af2e`.
The host checks that pin, then the guest installs the APK with normal OpenWrt
signature verification. The guest records the installed package version, core
version output and executable SHA256. Dependency indexes retain their normal signature verification.
The guest installs that exact core version through its signed repository index;
standalone OpenWrt APKs do not inherit index trust when installed by local path.
`--allow-untrusted` is confined to the separately checksum-verified Forkop APKs.
If this rolling feed removes the pinned APK, preparation deliberately fails;
updating the pin requires verifying another official target package.

The fixture installs the exact published 1.2.0 backend APK and verifies the five
original file hashes before applying `adapter/`. This directory contains only
the five generic maintenance adapter code files, their source hashes, and the
manifest; it contains no captured configuration. These are frozen compatibility
fixtures, not replacement implementations of snapshot, stop, locking, or resume.

The guest then exercises:

1. Synthetic UCI routing for two `.invalid` domains through a direct outbound.
2. A real maintenance snapshot, stop and resume, checking unchanged dnsmasq UCI
   during the deliberate stopped interval and retained warm FakeIP addresses.
3. Actual `apk add --upgrade` of the published 1.2.1-r2 backend APK, including its
   pre-upgrade and post-upgrade scripts, and a subsequent init-service restart.
4. Live core process, real procd `next-expiry` instance, consumed handoff, installed
   package version and unchanged kernel boot ID checks.
5. Actual handoff write failure before stop, followed by invalid-configuration
   resume failure, DNS failsafe and recovery. No production command is mocked.

The two FakeIP addresses are queried in reverse order after each restart, so
resetting an allocator cannot accidentally pass by assigning its first address
again. The core is real, but upstream proxy routing is not part of this test.

Every guest stage has a 300-second host timeout. The workflow is capped at 25
minutes and the runner at 18 minutes. During APK upgrade it records at most 120
process/RSS/log snapshots. Cleanup attempts bounded diagnostics even on failure,
then terminates QEMU. Uploaded evidence excludes the disk image and SSH key.

## Interpretation and current verification

This is an x86 integration test, not a certification of the original ARM router.
A passing result cannot establish or exclude a MediaTek driver/watchdog failure,
the original hardware's memory pressure, or a private installation-specific
trigger. It tests the exact published backend APKs, not a newly rebuilt checkout
and not the LuCI/IPK packages. It does not inject concurrent-lock contention.

The first booted VM run exposed a fixture ABI error: the upstream Linux amd64
1.14.3 executable needs a glibc loader unavailable on OpenWrt musl. That failure
occurred before Forkop started. Using the signed native target APK fixes this
fixture boundary without introducing a compatibility loader. This test covers
maintenance behavior with 1.13.21; it does not claim sing-box 1.14 compatibility.

No production runtime change accompanies this test. Initial local validation is
limited to shell/Python syntax and fixture hashes; the first real behavioral
RED/GREEN result must come from a completed workflow run. Any failure must be
classified from the retained stage, serial and process evidence before changing
production code.
