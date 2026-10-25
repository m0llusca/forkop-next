# Release revision identity: 1.2.1-r2

The corrected packages use a distinct version so previously published `1.2.1`
artifacts do not need replacement. Release versions accept `x.y.z` or `x.y.z-rN`,
where `N` is positive and has no leading zero. An absent revision compares as zero.

Regression tests execute production validation, comparison and asset resolution;
they do not contact a release server or install packages:

- `tests/release_revision.sh`: native ucode updater and embedded installer helper;
  plain releases, canonical revisions, numerical revision ordering, malformed
  revisions, complete malformed release manifests and exact APK/IPK assets.
- `tests/release_version_entrypoints.sh`: actual manual builder prefix through APK
  version assignment and actual workflow selection/validation prefix. Execution
  stops before build directories, host dependency checks or downloads.
- `tests/release_version_recipes.sh`: actual backend and LuCI Makefile validation
  and version assignments with SDK includes omitted. Checks both public version
  overrides, empty `PKG_RELEASE`, development fallback and shell quote injection.
- `tests/package_contract.sh`: backend recipe and both manual package formats must
  declare `kmod-nft-fib` for the local-address FIB routing guard.

Observed RED on the original source:

- Builder prefix rejects `1.2.1-r2`: `Expected release version in the form x.y.z`;
  the test reports `FAIL: builder rejected valid 1.2.1-r2`.
- Workflow prefix rejects `1.2.1-r2` with `Release version must use x.y.z format`.
- Package contract reports missing `+kmod-nft-fib` in the backend recipe.

Focused native ucode initially rejected valid `1.2.1-r1` (RED). After the change,
the same native fixture passed all version and asset identity cases (GREEN).
The first GREEN attempt caught a ucode function binding order regression; moving
the shared validator before release-plan definition resolved it.

Actual build/workflow prefix and dependency contract checks passed locally.
Archive identities and detailed execution evidence are in the task execution
report. Complete Ubuntu CI, GNU make recipe execution, built package identities
and actual APK version acceptance/order remain release verification steps.
