#!/usr/bin/env python3
"""Fetch immutable, checksum-pinned inputs, never router backups or credentials."""
import hashlib
import json
import pathlib
import shutil
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORK = ROOT / 'integration-work'
OPENWRT = 'https://downloads.openwrt.org/releases/25.12.6/targets/x86/64/'
OPENWRT_PACKAGES = 'https://downloads.openwrt.org/releases/packages-25.12/x86_64/packages/'
RELEASES = 'https://github.com/m0llusca/forkop-next/releases/download/'
ARTIFACTS = {
    'sing-box-1.13.21-r1.apk': (OPENWRT_PACKAGES + 'sing-box-1.13.21-r1.apk',
                              'afba690111db21f4f6650ce38b0a1af2711bec311cf51642861dc92c4256af2e'),
    'rootfs.img.gz': (OPENWRT + 'openwrt-25.12.6-x86-64-generic-ext4-rootfs.img.gz',
                      '8c243392d09b960a9f0edbfd996153bec213435b0034e6b2db9437115c5178ec'),
    'kernel.bin': (OPENWRT + 'openwrt-25.12.6-x86-64-generic-kernel.bin',
                   '8f70595f3a6eec3112e007450a1a600153904deffa52ab368712342583cb387c'),
    'forkop_1.2.0.apk': (RELEASES + '1.2.0/forkop_1.2.0.apk',
                        '335e5654944b3f9ba90b741b442f9437fdaba60f858e308dd41d1e62b123e212'),
    'forkop_1.2.1-r2.apk': (RELEASES + '1.2.1-r2/forkop_1.2.1-r2.apk',
                           '74750d1dcfa4261f8563c98329ec4c77394667e539c56cf6bf65f2f50301b417'),
}


def main():
    evidence = WORK / 'evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    payload = WORK / 'payload'
    payload.mkdir(exist_ok=True)
    for name, (url, digest) in ARTIFACTS.items():
        with urllib.request.urlopen(url, timeout=90) as response:
            data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('Checksum/size mismatch: ' + name)
        (payload if name.endswith('.apk') else WORK).joinpath(name).write_bytes(data)
        print('Verified', name, digest, flush=True)
    shutil.copy2(ROOT / 'tests/integration/guest.sh', payload / 'guest.sh')
    shutil.copytree(ROOT / 'tests/integration/adapter', payload / 'adapter', dirs_exist_ok=True)
    # Every adapter file is generic shipped code; manifest binds the exact five-file overlay.
    manifest = json.loads((payload / 'adapter/manifest.json').read_text())
    for item in manifest:
        path = payload / 'adapter' / item['path']
        if hashlib.sha256(path.read_bytes()).hexdigest() != item['after_sha256']:
            raise ValueError('Adapter mismatch: ' + item['path'])
    (payload / 'adapter/SHA256SUMS.before').write_text(''.join(
        item['before_sha256'] + '  ' + item['path'] + '\n' for item in manifest))
    (evidence / 'inputs.json').write_text(json.dumps({
        'artifacts': ARTIFACTS, 'adapter': manifest,
        'core': {'package_version': '1.13.21-r1', 'target': 'OpenWrt x86_64 musl',
                 'signature_verification': 'normal apk add; no allow-untrusted'},
        'ram_mib': 512,
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
