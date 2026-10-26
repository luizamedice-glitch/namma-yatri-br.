#!/usr/bin/env bash
# Updates only api in the existing Lightsail Compose project; no new public routes.
set -euo pipefail
umask 077
ROOT="${YATRI_SERVER_ROOT:-/opt/yatri-brasil}"
REPO="$ROOT/projeto"
COMPOSE="$ROOT/compose.yaml"
SHA="${1:-}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Informe o SHA completo de um commit revisado.' >&2; exit 2; }
for cmd in docker git python3 curl flock; do command -v "$cmd" >/dev/null; done
[[ -f "$COMPOSE" && -d "$REPO/.git" ]] || { echo 'Compose/checkout existentes nao encontrados.' >&2; exit 2; }
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo 'Outra implantacao esta em andamento.' >&2; exit 2; }
git -C "$REPO" cat-file -e "$SHA^{commit}"
# Do not checkout/reset the operator's working tree or print Compose/environment values.
docker compose -f "$COMPOSE" config --quiet
CID="$(docker compose -f "$COMPOSE" ps -q api)"
[[ -n "$CID" ]] || { echo 'API existente precisa estar em execucao.' >&2; exit 2; }
[[ "$(docker inspect --format '{{.State.Running}}' "$CID")" == true ]]
OLD_IMAGE="$(docker inspect --format '{{.Image}}' "$CID")"
# Preserve the actual project name even if the operator originally used -p.
PROJECT="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$CID")"
[[ -n "$PROJECT" && "$PROJECT" != '<no value>' ]]
DC=(docker compose --project-name "$PROJECT" -f "$COMPOSE")
WORK="$(mktemp -d "$ROOT/deploy-${SHA:0:12}-XXXXXX")"
git -C "$REPO" archive "$SHA" brasil/backend | tar -x -C "$WORK"
SOURCE="$WORK/brasil/backend"
# Automatic rollback is only safe when migration contents are unchanged.
docker exec "$CID" node -e '
const fs=require("fs"),crypto=require("crypto");
const files=fs.readdirSync("/app/migrations").filter(n=>n.endsWith(".sql")).sort();
console.log(JSON.stringify(Object.fromEntries(files.map(n=>[n,crypto.createHash("sha256").update(fs.readFileSync("/app/migrations/"+n)).digest("hex")]))));
' > "$WORK/current-migrations.json"
python3 - "$SOURCE" "$WORK/current-migrations.json" <<'PY'
import hashlib,json,sys
from pathlib import Path
expected={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((Path(sys.argv[1])/'migrations').glob('*.sql'))}
if expected != json.loads(Path(sys.argv[2]).read_text()):
    raise SystemExit('Migrations diferentes: preparar backup/revisao de banco antes de implantar.')
PY
IMAGE="yatri-br-api:$SHA"
BUILD_ARGS=()
# Optional public CA for managed development environments; never bake it into the image.
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then BUILD_ARGS+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT"); fi
docker build "${BUILD_ARGS[@]}" --build-arg "YATRI_REVISION=$SHA" -t "$IMAGE" "$SOURCE"
python3 - "$WORK" "$IMAGE" "$OLD_IMAGE" <<'PY'
import json,sys
from pathlib import Path
for name,image in [('candidate',sys.argv[2]),('rollback',sys.argv[3])]:
    (Path(sys.argv[1])/(name+'.json')).write_text(json.dumps({'services':{'api':{'image':image}}})+'\n')
PY
# Query the real existing DB using the inherited env_file, without migrations or startup.
"${DC[@]}" -f "$WORK/candidate.json" run --rm --no-deps --pull never --entrypoint node api src/deployment-check.mjs
health() {
  local id
  for attempt in $(seq 1 30); do
    id="$("${DC[@]}" ps -q api)"
    if [[ -n "$id" ]] && docker exec "$id" node -e '
fetch("http://127.0.0.1:"+(process.env.PORT||8080)+"/health",{signal:AbortSignal.timeout(3000)})
.then(async r=>{const b=await r.json();if(!r.ok||b.status!=="ok")process.exit(1)}).catch(()=>process.exit(1));
' >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}
rollback() {
  trap - ERR INT TERM
  echo 'Falha: restaurando somente a imagem anterior da API.' >&2
  "${DC[@]}" -f "$WORK/rollback.json" up -d --no-deps --no-build --pull never api
  if health; then echo 'API anterior restaurada.' >&2; else echo 'Rollback exige verificacao do operador.' >&2; fi
  exit 1
}
trap rollback ERR INT TERM
"${DC[@]}" -f "$WORK/candidate.json" up -d --no-deps --no-build --pull never api
NEW_CID="$("${DC[@]}" ps -q api)"
[[ "$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$NEW_CID")" == "$SHA" ]]
health
# Public contract remains health-only. Do not change Caddy/firewall here.
python3 "$SOURCE/ops/check-public.py"
cp "$WORK/candidate.json" "$ROOT/compose.api-image.json.tmp"
mv "$ROOT/compose.api-image.json.tmp" "$ROOT/compose.api-image.json"
trap - ERR INT TERM
printf 'API atualizada para %s. Registro local: %s\n' "$SHA" "$WORK"
printf 'Para repetir operacoes Compose, inclua -f %s/compose.api-image.json\n' "$ROOT"
