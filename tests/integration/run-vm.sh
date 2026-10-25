#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "$0")/../.." && pwd)
WORK="$ROOT/integration-work"
cd "$WORK"
mkdir -p evidence mount
VM_PID=
MOUNTED=0
SSH=(ssh -p 22222 -i "$WORK/guest-key" -o BatchMode=yes -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile="$WORK/known-hosts" -o ConnectTimeout=5
  -o ServerAliveInterval=5 -o ServerAliveCountMax=2 root@127.0.0.1)
cleanup() {
  status=$?
  trap - EXIT TERM INT
  if [[ -n "$VM_PID" ]]; then
    timeout 20s "${SSH[@]}" 'sh /root/integration/guest.sh diagnostics' > evidence/final-diagnostics.log 2>&1 || true
    timeout 15s "${SSH[@]}" 'tar -C /tmp -czf - integration-evidence' > evidence/guest-evidence.tar.gz 2>/dev/null || true
    kill "$VM_PID" 2>/dev/null || true
    wait "$VM_PID" 2>/dev/null || true
  fi
  if [[ "$MOUNTED" = 1 ]]; then sudo umount "$WORK/mount"; fi
  # Never upload the disk image, generated SSH private key, or whole filesystem.
  exit "$status"
}
trap cleanup EXIT
trap 'exit 124' TERM INT
ssh-keygen -q -t ed25519 -N '' -f guest-key
gzip -dc rootfs.img.gz > guest.img
truncate -s 768M guest.img
fsck_status=0
e2fsck -pf guest.img || fsck_status=$?
# e2fsck returns 1 for a successfully repaired, unmounted image.
# The published rootfs needs an inode-bitmap padding repair before resizing.
[[ "$fsck_status" = 0 || "$fsck_status" = 1 ]] || exit "$fsck_status"
resize2fs guest.img
sudo mount -o loop guest.img "$WORK/mount"
MOUNTED=1
sudo mkdir -p mount/root/integration mount/etc/dropbear
sudo cp -a payload/. mount/root/integration/
sudo cp guest-key.pub mount/etc/dropbear/authorized_keys
sudo chmod 600 mount/etc/dropbear/authorized_keys
sudo tee mount/etc/config/network >/dev/null <<'EOF'
config interface 'loopback'
 option device 'lo'
 option proto 'static'
 option ipaddr '127.0.0.1'
 option netmask '255.0.0.0'
config device
 option name 'br-lan'
 option type 'bridge'
 list ports 'eth0'
config interface 'lan'
 option device 'br-lan'
 option proto 'static'
 option ipaddr '10.0.2.15'
 option netmask '255.255.255.0'
 option gateway '10.0.2.2'
 list dns '10.0.2.3'
EOF
sudo umount "$WORK/mount"
MOUNTED=0
ACCEL=tcg
[[ -r /dev/kvm && -w /dev/kvm ]] && ACCEL=kvm
qemu-system-x86_64 -accel "$ACCEL" -m 512 -smp 2 -display none -monitor none -no-reboot \
  -kernel kernel.bin -append 'root=/dev/vda rootwait console=ttyS0,115200 reboot=t panic=1' \
  -drive file=guest.img,format=raw,if=virtio \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:22222-:22 \
  -device virtio-net-pci,netdev=net0 -serial file:evidence/serial.log >evidence/qemu.log 2>&1 &
VM_PID=$!
ready=0
for _ in $(seq 1 90); do
  kill -0 "$VM_PID" || { cat evidence/qemu.log; exit 1; }
  if "${SSH[@]}" 'test -S /var/run/ubus/ubus.sock && command -v apk' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" = 1 ]] || { tail -100 evidence/serial.log; exit 1; }
# Each stage has its own wall-clock boundary and retains logs if the guest hangs.
for stage in setup upgrade boundaries; do
  echo "Running real guest stage: $stage"
  timeout --signal=TERM --kill-after=10s 300s "${SSH[@]}" \
    "sh /root/integration/guest.sh $stage" 2>&1 | tee "evidence/$stage.log"
done
