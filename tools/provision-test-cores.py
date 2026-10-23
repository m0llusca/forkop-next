#!/usr/bin/env python3
"""Install checksum-pinned, official Linux amd64 cores into the isolated test path."""
import hashlib
import io
import pathlib
import tarfile
import urllib.request

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

if __name__ == '__main__':
    main()
