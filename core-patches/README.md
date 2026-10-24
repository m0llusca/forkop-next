# REALITY record compatibility core

This directory contains a GPL-3.0-or-later patch for sing-box Extended. Its LICENSE applies to the core patch; the surrounding Forkop project retains its existing license and upstream notices.

The source base is shtorm-7/sing-box-extended commit d9442d14b19ddd02605bf3ee893a171947038e19. The patched source identity is the base plus SHA256 of 0001-reality-record-fragment.patch, not the unmodified upstream commit alone. Exact executable, archive and source-archive identities are recorded in manifest.json.

The new optional tls.reality.record_fragment_size setting only changes framing of the first ClientHello into bounded TLS records. Zero keeps the original path. It preserves authentication bytes, key shares, certificate verification and subsequent traffic. No packet delay or alternate server is required. Native Forkop adaptation uses 256 only with the exact admitted custom executable; a displayed version suffix or source marker cannot grant capability.

Build with Go 1.26.10 and the exact upstream source revision:

```sh
git clone https://github.com/shtorm-7/sing-box-extended.git core
cd core
git checkout --detach d9442d14b19ddd02605bf3ee893a171947038e19
git apply /path/to/0001-reality-record-fragment.patch
go test -tags with_utls ./common/tlsfragment ./common/tls -run '^Test(RecordConn|RealityRecord|UTLSClient_Client)' -count=1
(cd service/admin_panel/web && npm ci --ignore-scripts --no-audit --no-fund && npm run build)
go run ./cmd/internal/admin_panel_pack -dir service/admin_panel/dist
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -tags "$(cat release/DEFAULT_BUILD_TAGS_OTHERS)" -ldflags "-X github.com/sagernet/sing-box/constant.Version=1.14.3-extended-2.7.3-forkop-record1 $(cat release/LDFLAGS) -s -w -buildid=" -o sing-box ./cmd/sing-box
upx --best --lzma -o sing-box-compressed sing-box
upx -t sing-box-compressed
```

UPX 5.2.1 was used for the admitted compressed artifact. Every upstream Extended release tag is retained, including the compiled administration panel. Build outputs must receive their own verified identities; do not substitute an executable hash for an archive hash or admit a different build by version alone.

Validation includes native transformer/authentication/cancellation tests and isolated direct-path checks against Xray 26.10.21 and 26.7.28. The wrong REALITY key was rejected. Short successful probe series do not establish long-term reliability. The source archive includes the complete core checkout used for this build, generated administration assets, the patch and build metadata; module versions and checksums remain pinned by the upstream go.mod/go.sum.
