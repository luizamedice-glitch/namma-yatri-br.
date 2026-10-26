#!/usr/bin/env bash
# Only ciphertext and boolean reports may enter the artifact directory.
set -euo pipefail
set +x
umask 077
work=$(mktemp -d "$RUNNER_TEMP/yatri-maintenance.XXXXXX")
remote_dir=''
cleanup() {
  if [[ -n "$remote_dir" ]]; then ssh "${args[@]}" "$target" "rm -rf -- '$remote_dir'" </dev/null >/dev/null 2>&1 || true; fi
  rm -rf -- "$work"
}
trap cleanup EXIT
printf '%s\n' "$AWS_SSH_KEY" > "$work/key"
unset AWS_SSH_KEY
touch "$work/known_hosts"
host_check=accept-new
if [[ -n "${AWS_SSH_KNOWN_HOSTS:-}" ]]; then
  printf '%s\n' "$AWS_SSH_KNOWN_HOSTS" > "$work/known_hosts"
  host_check=yes
fi
args=(-i "$work/key" -o IdentitiesOnly=yes -o BatchMode=yes -o ForwardAgent=no -o ConnectTimeout=15 -o "StrictHostKeyChecking=$host_check" -o "UserKnownHostsFile=$work/known_hosts")
target=ubuntu@52.67.246.31
remote='sudo -n python3 /opt/yatri-brasil/operations/current/maintenance.py'
artifacts="$RUNNER_TEMP/maintenance-artifacts"
mkdir -p "$artifacts"
case "$YATRI_MAINTENANCE_OPERATION" in
  install)
    sha=$(git rev-parse HEAD)
    openssl pkey -in "$work/key" -pubout -out "$work/recipient.pem" 2>/dev/null
    remote_dir=$(ssh "${args[@]}" "$target" 'mktemp -d /tmp/yatri-maintenance.XXXXXX')
    [[ "$remote_dir" =~ ^/tmp/yatri-maintenance\.[a-zA-Z0-9]+$ ]]
    git archive --format=tar.gz "$sha" brasil/backend/ops > "$work/ops.tar.gz"
    scp "${args[@]}" "$work/ops.tar.gz" "$work/recipient.pem" "$target:$remote_dir/" >/dev/null
    ssh "${args[@]}" "$target" "tar -xzf '$remote_dir/ops.tar.gz' -C '$remote_dir' && sudo -n python3 '$remote_dir/brasil/backend/ops/install-maintenance.py' '$remote_dir/brasil/backend/ops' '$sha' '$remote_dir/recipient.pem'" > "$artifacts/installation.json"
    ;;
  backup|status) ;;
  *) echo 'Operacao invalida.' >&2;exit 1;;
esac
if [[ "$YATRI_MAINTENANCE_OPERATION" != status ]]; then
  ssh "${args[@]}" "$target" "$remote export" </dev/null > "$artifacts/backup.json"
  name=$(python3 -c 'import json,re,sys;v=json.load(open(sys.argv[1]));n=v["file"];assert re.fullmatch(r"yatri-db-[0-9]{8}T[0-9]{12}Z\.ybk",n);assert v["encrypted"] is True;print(n)' "$artifacts/backup.json")
  ssh "${args[@]}" "$target" "sudo -n cat '/opt/yatri-brasil/backups/$name'" </dev/null > "$artifacts/$name"
  python3 -c 'import hashlib,json,pathlib,sys;m=json.load(open(sys.argv[1]));p=pathlib.Path(sys.argv[2]);assert p.stat().st_size==m["bytes"];assert hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==m["sha256"]' "$artifacts/backup.json" "$artifacts/$name"
  node brasil/backend/ops/backup-crypto.mjs decrypt "$work/key" "$artifacts/$name" "$work/restored.dump" >/dev/null
  python3 brasil/backend/ops/verify-backup.py "$work/restored.dump" brasil/backend/migrations > "$artifacts/restore.json"
  digest=$(python3 -c 'import json,sys;v=json.load(open(sys.argv[1]))["sha256"];assert len(v)==64 and all(c in "0123456789abcdef" for c in v);print(v)' "$artifacts/backup.json")
  ssh "${args[@]}" "$target" "$remote verified '$name' '$digest'" </dev/null > "$artifacts/verification.json"
fi
ssh "${args[@]}" "$target" "$remote monitor" </dev/null > "$artifacts/health.json"
python3 -c 'import json,sys;v=json.load(open(sys.argv[1]));assert v["healthy"] is True;print("Backup/monitoramento: verificacoes aprovadas.")' "$artifacts/health.json"
