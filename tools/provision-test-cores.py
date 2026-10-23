#!/usr/bin/env python3
"""Install checksum-pinned, official Linux amd64 cores into the isolated test path."""
import hashlib
import io
import pathlib
import tarfile
import urllib.request
import zipfile

XRAY_VERSION = '26.10.21'
XRAY_SHA256 = '0eec3ed4163c273d8c8bf821f7d219e257921cf584aa3fb970715e458e631978'
XRAY_URL = f'https://github.com/XTLS/Xray-core/releases/download/v{XRAY_VERSION}/Xray-linux-64.zip'

def install_xray_archive(archive, digest, root):
    if len(archive) > 64 * 1024 * 1024 or hashlib.sha256(archive).hexdigest() != digest:
        raise ValueError('Invalid Xray archive checksum or size')
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        member = bundle.getinfo('xray')
        if member.is_dir() or member.file_size > 128 * 1024 * 1024:
            raise ValueError('Invalid Xray executable')
        executable = bundle.read(member)
    destination = root / f'xray-{XRAY_VERSION}-linux-amd64' / 'xray'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(executable)
    destination.chmod(0o755)
    return destination

CORES = {
    '1.13.7': '9e8006c188c42f333da1f03ed21daca69d2c20bb8678c7782205b6c1aeeee23b',
    '1.14.3': 'e2bdf179c15a3652955dc44867e33ca0965c9c9b91b34267dcc5a5d639a5feee',
}

def main():
    root = pathlib.Path('/tmp/forkop-cores')
    for version, digest in CORES.items():
        name = f'sing-box-{version}-linux-amd64'
        url = f'https://github.com/SagerNet/sing-box/releases/download/v{version}/{name}.tar.gz'
        with urllib.request.urlopen(url, timeout=90) as response:
            archive = response.read(64 * 1024 * 1024 + 1)
        if len(archive) > 64 * 1024 * 1024 or hashlib.sha256(archive).hexdigest() != digest:
            raise SystemExit(f'Invalid published archive: {name}')
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as bundle:
            member = bundle.getmember(f'{name}/sing-box')
            if not member.isfile() or member.size > 128 * 1024 * 1024:
                raise SystemExit(f'Invalid executable: {name}')
            destination = root / name / 'sing-box'
            destination.parent.mkdir(parents=True, exist_ok=True)
            with bundle.extractfile(member) as source:
                destination.write_bytes(source.read())
            destination.chmod(0o755)
        print(f'Verified official core {version}')
    with urllib.request.urlopen(XRAY_URL, timeout=90) as response:
        archive = response.read(64 * 1024 * 1024 + 1)
    install_xray_archive(archive, XRAY_SHA256, root)
    print(f'Verified official Xray {XRAY_VERSION}')

if __name__ == '__main__':
    main()
