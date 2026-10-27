#!/usr/bin/env bash
# Export only ciphertext and health reports; never restore or reinstall runtime.
set -euo pipefail
set +x
for name in AWS_SSH_KEY AWS_HOST AWS_USER; do
  if [[ -z "${!name}" ]]; then
    echo "::error::Secret obrigatória ausente: $name"
    exit 1
  fi
done
if [[ ! "$AWS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] ||
   [[ ! "$AWS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]; then
  echo '::error::Formato de AWS_HOST ou AWS_USER inválido.'
  exit 1
fi
umask 077
ssh_dir=$(mktemp -d "$RUNNER_TEMP/yatri-ssh.XXXXXX")
trap 'rm -rf -- "$ssh_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Copiar no celular pode adicionar texto do terminal e mudar as quebras.
# Normaliza apenas a formatação; não tenta adivinhar caracteres da chave.
python3 - "$ssh_dir/key" <<'PY'
import base64, os, re, sys
from pathlib import Path
text = os.environ['AWS_SSH_KEY'].replace('\\r\\n', '\n').replace('\\n', '\n')
pattern = r'-----BEGIN ((?:OPENSSH|RSA|EC) PRIVATE KEY)-----([\s\S]*?)-----END \1-----'
blocks = list(re.finditer(pattern, text))
if len(blocks) != 1:
    sys.exit('::error::Cole exatamente um bloco de chave privada, incluindo BEGIN e END, no secret AWS_SSH_KEY.')
label, body = blocks[0].groups()
body = re.sub(r'\s+', '', body)
try:
    decoded = base64.b64decode(body, validate=True)
except Exception:
    sys.exit('::error::O bloco da chave contém caracteres inválidos ou está incompleto. Copie novamente o arquivo original.')
if not decoded:
    sys.exit('::error::O bloco da chave está vazio.')
lines = '\n'.join(body[i:i+70] for i in range(0, len(body), 70))
Path(sys.argv[1]).write_text(f'-----BEGIN {label}-----\n{lines}\n-----END {label}-----\n')
PY
unset AWS_SSH_KEY
chmod 600 "$ssh_dir/key"
# Recusa chaves inválidas ou com senha, sem imprimir conteúdo nem pedir entrada.
if ! ssh-keygen -y -P '' -f "$ssh_dir/key" > /dev/null 2>&1; then
  echo '::error::AWS_SSH_KEY deve conter uma chave privada SSH válida sem senha.'
  exit 1
fi
host_check=accept-new
if [[ -n "$AWS_SSH_KNOWN_HOSTS" ]]; then
  printf '%s\n' "$AWS_SSH_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
  host_check=yes
else
  echo '::notice::Primeira conexão: identidade do host aceita por TOFU. Configure AWS_SSH_KNOWN_HOSTS para verificação prévia.'
  touch "$ssh_dir/known_hosts"
fi
unset AWS_SSH_KNOWN_HOSTS
args=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes -o ForwardAgent=no -o ConnectTimeout=15 -o "StrictHostKeyChecking=$host_check" -o "UserKnownHostsFile=$ssh_dir/known_hosts")
target="$AWS_USER@$AWS_HOST"
artifacts="$RUNNER_TEMP/alce-maintenance-artifacts"
mkdir -p "$artifacts"
remote='sudo -n python3 /opt/alce-lab/operations/current/maintenance.py'
if [[ "${ALCE_MAINTENANCE_OPERATION:-backup}" == backup ]]; then
ssh "${args[@]}" "$target" "$remote export" </dev/null > "$artifacts/backup.json"
name=$(python3 -c 'import json,re,sys;v=json.load(open(sys.argv[1]));n=v["file"];assert re.fullmatch(r"yatri-db-[0-9]{8}T[0-9]{12}Z\.ybk",n);assert v["encrypted"] is True;print(n)' "$artifacts/backup.json")
ssh "${args[@]}" "$target" "sudo -n cat '/opt/alce-lab/backups/$name'" </dev/null > "$artifacts/$name"
python3 -c 'import hashlib,json,pathlib,sys;m=json.load(open(sys.argv[1]));p=pathlib.Path(sys.argv[2]);assert p.stat().st_size==m["bytes"];assert hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==m["sha256"]' "$artifacts/backup.json" "$artifacts/$name"
node brasil/backend/ops/backup-crypto.mjs decrypt "$ssh_dir/key" "$artifacts/$name" "$ssh_dir/restored.dump" >/dev/null
python3 brasil/backend/ops/verify-backup.py "$ssh_dir/restored.dump" brasil/backend/migrations > "$artifacts/restore.json"
digest=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["sha256"])' "$artifacts/backup.json")
[[ "$digest" =~ ^[a-f0-9]{64}$ ]]
ssh "${args[@]}" "$target" "$remote verified '$name' '$digest'" </dev/null > "$artifacts/verification.json"
fi
ssh "${args[@]}" "$target" "$remote monitor" </dev/null > "$artifacts/health.json"
python3 -c 'import json,sys;v=json.load(open(sys.argv[1]));assert v["healthy"] is True;print("Alce: verificações operacionais aprovadas.")' "$artifacts/health.json"
