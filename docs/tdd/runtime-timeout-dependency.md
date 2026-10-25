# Public CLI timeout dependency

The public Extended preview CLI runs its read inside a ten-second `timeout`
budget. A clean official OpenWrt installation without a timeout executable
returned exit 127 instead of the expected CLI response. This is a missing
runtime dependency: the budget must remain in place.

The backend SDK definition and both release package formats now require
`coreutils-timeout`. No runtime command, timeout duration, TLS, DNS, preview or
service behavior is changed.

## Test-first evidence

```sh
python3 -m unittest discover -s tests/backend -p test_runtime_timeout_dependency.py -v
```

Before the metadata change, all three tests failed because the SDK, IPK and APK
dependency declarations omitted `coreutils-timeout`. After adding the dependency
to those declarations, all three passed. This checks a required positive package
dependency in each format, rather than accepting a similarly named or conflict
entry.

The original native public-CLI failure and the passing timeout-stub test identify
the missing executable without bypassing the budget. After installing the
dependency in an isolated native test environment, the public-CLI boundary test
passed using the actual executable. The timeout-budget regression test also
passed; its timeout stub checks that the requested budget remains ten seconds.
A separate expired-command check returned timeout status 124. Saved package
metadata alone does not prove which BusyBox applets a different installation
exposes. The full Linux backend and package-build gates remain required before
release.

## Platform availability

The official [OpenWrt 24.10 package feed](https://downloads.openwrt.org/releases/packages-24.10/aarch64_generic/packages/Packages)
provides `coreutils-timeout`, including the alternatives mapping from
`/usr/bin/timeout` to `/usr/libexec/timeout-coreutils`. The original
[24.10.0 feed archive](https://archive.openwrt.org/releases/24.10.0/packages/x86_64/packages/)
also lists the package. The official
[OpenWrt 25.12 feed](https://downloads.openwrt.org/releases/packages-25.12/aarch64_generic/packages/)
provides the APK variant. Unlike the optional native digest acceleration, this
executable is required for the existing public CLI contract.
