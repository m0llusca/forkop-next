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
XRAY_RELEASES = {
    XRAY_VERSION: XRAY_SHA256,
    '26.9.30': 'f851110beaff16e78d643f0ccfd9524b4a44dfd59bae3e34bb52bba378f7690e',
    '26.6.27': 'b3e5902d06d6282fe53cfa2fc426058b9aeaa429b2c812e20887cd47f26d08bf',
}
EXTENDED_VERSION = '1.14.3-extended-2.7.3'
EXTENDED_SHA256 = 'c9fd27564d55b6abc7b21c9fdd1e29dee4834e034aeb6b7b8255055bff46a3f5'
# Exact official asset 656798159, verified through the release API and archive.
EXTENDED_URL = 'https://github.com/shtorm-7/sing-box-extended/releases/download/v1.14.3-extended-2.7.3/sing-box-1.14.3-extended-2.7.3-linux-amd64.tar.gz'
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_EXECUTABLE = 128 * 1024 * 1024


def verify_archive(archive, digest, name):
    if len(archive) > MAX_ARCHIVE or hashlib.sha256(archive).hexdigest() != digest:
        raise ValueError(f'Invalid {name} archive checksum or size')


def write_executable(root, name, executable):
    destination = root / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(executable)
    destination.chmod(0o755)
    return destination


def install_xray_archive(archive, digest, root, version=XRAY_VERSION):
    if version not in XRAY_RELEASES:
        raise ValueError('Unpinned Xray version')
    verify_archive(archive, digest, 'Xray')
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        members = [member for member in bundle.infolist() if member.filename == 'xray']
        if len(members) != 1 or members[0].is_dir() or members[0].file_size > MAX_EXECUTABLE:
            raise ValueError('Invalid Xray executable')
        executable = bundle.read(members[0])
    return write_executable(root, f'xray-{version}-linux-amd64/xray', executable)


def install_sing_box_archive(archive, digest, root, version):
    verify_archive(archive, digest, 'sing-box')
    name = f'sing-box-{version}-linux-amd64'
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as bundle:
        members = [member for member in bundle.getmembers() if member.name == f'{name}/sing-box']
        if len(members) != 1 or not members[0].isfile() or members[0].size > MAX_EXECUTABLE:
            raise ValueError('Invalid sing-box executable')
        with bundle.extractfile(members[0]) as source:
            executable = source.read(MAX_EXECUTABLE + 1)
        if len(executable) != members[0].size:
            raise ValueError('Invalid sing-box executable size')
    return write_executable(root, f'{name}/sing-box', executable)


def install_extended_archive(archive, digest, root):
    return install_sing_box_archive(archive, digest, root, EXTENDED_VERSION)


CORES = {
    '1.13.7': '9e8006c188c42f333da1f03ed21daca69d2c20bb8678c7782205b6c1aeeee23b',
    '1.14.3': 'e2bdf179c15a3652955dc44867e33ca0965c9c9b91b34267dcc5a5d639a5feee',
}


def download(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read(MAX_ARCHIVE + 1)


def main():
    root = pathlib.Path('/tmp/forkop-cores')
    for version, digest in CORES.items():
        name = f'sing-box-{version}-linux-amd64'
        url = f'https://github.com/SagerNet/sing-box/releases/download/v{version}/{name}.tar.gz'
        install_sing_box_archive(download(url), digest, root, version)
        print(f'Verified official core {version}')
    install_extended_archive(download(EXTENDED_URL), EXTENDED_SHA256, root)
    print(f'Verified official Extended {EXTENDED_VERSION}')
    for version, digest in XRAY_RELEASES.items():
        url = f'https://github.com/XTLS/Xray-core/releases/download/v{version}/Xray-linux-64.zip'
        install_xray_archive(download(url), digest, root, version)
        print(f'Verified official Xray {version}')


if __name__ == '__main__':
    main()
