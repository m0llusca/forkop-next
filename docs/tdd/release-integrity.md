# Release integrity TDD evidence

2026-10-23. Commands execute the real build helper definitions, SHA256 utility,
filesystem, Git and C compiler in temporary fixtures. The download transport is
replaced only for deterministic failure tests. No router or VPS is contacted.

Command: `python3 -m unittest discover -s tests/backend -p test_release_download.py -v`

- RED snapshot `e2be2d2a10cf`: 5 tests, 4 failures. A modified cached archive,
  mismatching new download and absent digest were accepted; the translation tool
  used mutable SDK feed state rather than the requested commit. Valid download
  control passed. An earlier harness error concerning `BASH_SOURCE` was corrected
  before this RED observation; it was not used as feature-failure evidence.
- GREEN snapshot `eae2cf708ca0`: 5 tests passed. Mismatches cannot promote a `.part`
  file or return a usable cache path. Valid verified download is promoted. A real
  local Git repository with a newer moving HEAD still builds the pinned older tool.
- Actual official LuCI checkout/build snapshot `7c5a2b7d306d`: fetched exact commit
  `0e6537981036ea221a73e497920192179e9f74c3`, generated the plural parser, compiled
  and linked `po2lmo` successfully. This is separate from local transport fixtures.

Official source observations:

- [OpenWrt 24.10.6 SHA256 manifest](https://downloads.openwrt.org/releases/24.10.6/targets/x86/64/sha256sums)
  pins the SDK to `9e398ea7efc098e4a986f97efff595e32d08c615fe356bcb3d885d7ad3a39ac0`.
- [OpenWrt 25.12.3 SHA256 manifest](https://downloads.openwrt.org/releases/25.12.3/targets/x86/64/sha256sums)
  pins the SDK to `70fc990b2f9a2705e8bbca610e421a55e789901d4aeba10d9fdd7c89777bf695`.
- `git ls-remote https://github.com/openwrt/luci.git refs/heads/openwrt-24.10`
  returned `0e6537981036ea221a73e497920192179e9f74c3`; the build pins this commit,
  and does not follow the branch during later builds.

SDK URL overrides retain hash verification; operators must supply the matching
`IPK_SDK_SHA256` / `APK_SDK_SHA256` when changing the SDK artifact. SDK downloads and
redirects permit HTTPS only. Cached archives are rehashed before extraction/reuse.
Cached LuCI source is force-checked out and build outputs cleaned before compiling.
The normal package build still requires the supported Linux host toolchain.

This evidence does not assert byte-identical packages across hosts, an executed
router install, or a successful server handshake. The integration owner records
the final complete suite and actual package build separately.
