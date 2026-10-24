#!/bin/sh
# Hermetic ucode fixture: no service actions, proxy execution or network probes.
set -eu
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
LIB=${FORKOP_TEST_LIB:-"$ROOT_DIR/forkop/files/usr/lib"}
UCODE=${UCODE:-ucode}
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT HUP INT TERM
VERSION=1.14.3-extended-2.7.3-forkop-record1
mkdir -p "$WORK_DIR/trust/singbox"
printf '#!/bin/sh\necho "sing-box version %s"\n' "$VERSION" > "$WORK_DIR/sing-box"
chmod 755 "$WORK_DIR/sing-box"
SHA=$(sha256sum "$WORK_DIR/sing-box" | cut -d ' ' -f 1)
printf '{"schema":1,"cores":[{"version":"%s","sha256":"%s","reality_hybrid":true,"reality_record_fragment":true,"fingerprints":["chrome"]}]}' "$VERSION" "$SHA" > "$WORK_DIR/trust/singbox/validated-cores.json"
export FORKOP_LIB="$WORK_DIR/trust" FORKOP_SINGBOX_BINARY="$WORK_DIR/sing-box" FORKOP_SING_BOX_VERSION="$VERSION"
export FORKOP_SECTION_CACHE_DIR="$WORK_DIR/cache" TMP_SUBSCRIPTION_FOLDER="$WORK_DIR/subscriptions"
OUTBOUND='{"type":"vless","tag":"fixture-node","server":"example.invalid","server_port":443,"uuid":"00000000-0000-4000-8000-000000000001","flow":"xtls-rprx-vision","tls":{"enabled":true,"server_name":"example.org","utls":{"enabled":true,"fingerprint":"chrome"},"reality":{"enabled":true,"public_key":"PUBLICKEY","short_id":"aabb"}}}'
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
make_fixture() {
 "$UCODE" -L "$LIB" -e 'let fs=require("fs"),o=json(ARGV[0]); if(ARGV[2]!="absent")o.tls.reality.record_fragment_size=json(ARGV[2]);fs.writefile(ARGV[1],sprintf("%J",{settings:{".name":"settings",".type":"settings",dns_server:["1.1.1.1"],bootstrap_dns_server:["1.1.1.1"]},section:[{".name":"main",".type":"section",enabled:"1",action:"connection",outbound_jsons:[sprintf("%J",o)]}]}));' "$OUTBOUND" "$WORK_DIR/input.json" "$1"
}
case "${1:-all}" in adapter|all)
 "$UCODE" -L "$LIB" -e 'let a=require("singbox.reality"),p=a.verified_runtime(ARGV[0]),o=json(ARGV[1]);a.adapt_outbound(o,p);if(o.tls.reality.record_fragment_size!==256)die("expected record_fragment_size=256 from verified record profile");o=json(ARGV[1]);o.tls.reality.record_fragment_size=0;a.adapt_outbound(o,p);if(o.tls.reality.record_fragment_size!==0)die("explicit zero lost");print("PASS: adapter auto-policy and explicit opt-out\n");' "$VERSION" "$OUTBOUND"
 ;; esac
case "${1:-all}" in generator|all)
 make_fixture absent
 "$UCODE" -L "$LIB" "$LIB/singbox/generator.uc" generate-config-fixture "$WORK_DIR/input.json" "$WORK_DIR/output.json" 127.0.0.1
 "$UCODE" -e 'let c=json(require("fs").readfile(ARGV[0])),found=false;for(let o in c.outbounds)if(o.type=="vless"){found=true;if(o.tls.reality.record_fragment_size!==256)die("generated outbound lacks record policy");if(o.tls.insecure===true)die("TLS verification weakened");}if(!found)die("fixture outbound missing");print("PASS: real generator policy\n");' "$WORK_DIR/output.json"
 ;; esac
case "${1:-all}" in validator|all)
 make_fixture 256
 "$UCODE" -L "$LIB" "$LIB/config/validator.uc" validate-runtime-fixture "$WORK_DIR/input.json" '{}' > "$WORK_DIR/validate.log" 2>&1 || { cat "$WORK_DIR/validate.log"; fail 'valid record fixture rejected'; }
 for value in -1 1.5 16385 '"256"' true null '{}' '[]'; do
  make_fixture "$value"
  if "$UCODE" -L "$LIB" "$LIB/config/validator.uc" validate-runtime-fixture "$WORK_DIR/input.json" '{}' > "$WORK_DIR/validate.log" 2>&1; then fail "validator accepted record_fragment_size=$value"; fi
  grep -q 'record_fragment_size' "$WORK_DIR/validate.log" || { cat "$WORK_DIR/validate.log"; fail 'unrelated validation failure'; }
 done
 make_fixture 0
 printf '# untrusted binary change\n' >> "$WORK_DIR/sing-box"
 if "$UCODE" -L "$LIB" "$LIB/config/validator.uc" validate-runtime-fixture "$WORK_DIR/input.json" '{}' > "$WORK_DIR/validate.log" 2>&1; then fail 'validator accepted explicit zero on unverified binary'; fi
 grep -q 'record_fragment_size' "$WORK_DIR/validate.log" || { cat "$WORK_DIR/validate.log"; fail 'unrelated identity failure'; }
 printf 'PASS: real validator schema and exact identity\n'
 ;; esac
