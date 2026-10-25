# Captured-byte SHA256 acceleration

Configuration generation hashes captured source bytes for Extended preview
provenance. Interpreted SHA256 adds avoidable generation work when the native
ucode digest module is available. Both paths must produce the same digest over
the same bytes, including embedded NUL and UTF-8, without writing hash inputs or
passing them to subprocesses.

The native provider is optional and selected once per module load. Missing or
noncallable SHA256 exports, native exceptions and malformed results retain the
existing interpreted implementation. The public `{digest}` interface and all
capture, preview verification and core admission contracts remain unchanged.

## Test-first evidence

Run on a native ucode installation with the digest module available:

```sh
sh tests/sha256_native.sh
```

Before the runtime change, this command failed with exit 254 at
`digest must call native SHA256 exactly once per input`. The empty-input digest
was already correct, but the available native provider was never called.
The initial shell portability setup error was corrected before recording this
RED result; that setup failure is not regression evidence.

The test uses the real native hash behind a spy to prove exact-byte delegation
and one call per digest. It independently checks literal known hashes, cached
selection, a genuinely absent module with restricted search paths, unavailable
exports, exceptions and malformed native results. Loader fixtures use ucode's
documented global module cache; no production testing switch is added.

The Linux backend workflow now explicitly builds digest support with libmd and
checks the installed native provider. `tests/run-backend.sh` discovers the new
shell test automatically.
This native-provider gate intentionally requires `digest` in the developer test
environment. It is not a runtime package requirement: older supported systems
retain the fallback, whose genuine module-absent path is exercised in the test.

The native test passed after the implementation change. An additional binary
corpus checked both the native and forced-fallback paths against an independent
SHA256 oracle, including padding boundaries and embedded NUL bytes. Generated
configuration and complete Extended metadata were equivalent between the old
and accelerated implementations. These targeted checks do not replace the full
Linux backend and package-build gates, which remain required before release.

## Platform compatibility

The installer declares OpenWrt 24.10 or newer. The original
[24.10.0 ucode package definition](https://raw.githubusercontent.com/openwrt/openwrt/v24.10.0/package/utils/ucode/Makefile)
has no digest module, while the pinned
[24.10.6](https://raw.githubusercontent.com/openwrt/openwrt/v24.10.6/package/utils/ucode/Makefile)
and [25.12.3](https://raw.githubusercontent.com/openwrt/openwrt/v25.12.3/package/utils/ucode/Makefile)
SDK releases define it. Keeping the dependency optional preserves existing
installations; acceleration requires the native module to be installed.
