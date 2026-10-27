#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# New, loopback-only deployment. Never changes /opt/yatri-brasil or its DB.
set -euo pipefail
set +x
umask 077
image=yatri-driver-pilot:8d24ad18edebe754341e7839261122b70a440777
root=/opt/alce-lab
profile=${1:?Private profile file required}
test "$(id -u)" = 0
test -f "$profile"
test ! -e "$root"
test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = 8d24ad18edebe754341e7839261122b70a440777
for name in alce-lab-postgres alce-lab-api; do
  if docker container inspect "$name" >/dev/null 2>&1; then exit 1; fi
done
if docker network inspect alce-lab >/dev/null 2>&1; then exit 1; fi
if docker volume inspect alce-lab-postgres >/dev/null 2>&1; then exit 1; fi
if ss -ltnH | awk '{print $4}' | grep -Eq ':8083$'; then exit 1; fi
mkdir -m 700 "$root" "$root/private"
success=false
cleanup() {
  if [[ "$success" != true ]]; then
    docker rm -f alce-lab-api alce-lab-postgres >/dev/null 2>&1 || true
    docker network rm alce-lab >/dev/null 2>&1 || true
    docker volume rm alce-lab-postgres >/dev/null 2>&1 || true
    rm -rf -- "$root"
  fi
}
trap cleanup EXIT
# Resolve runtime configuration internally; no secret values reach stdout.
python3 - "$root" <<'PY'
import json,secrets,subprocess,sys
from pathlib import Path
from datetime import datetime,timedelta,timezone
r=Path(sys.argv[1]);password=secrets.token_hex(32)
source=json.loads(subprocess.check_output(['docker','inspect','yatri-brasil-driver-pilot-1']))[0]
env=dict(x.split('=',1) for x in source['Config']['Env'] if '=' in x)
database='postgresql://alce_lab:'+password+'@alce-lab-postgres:5432/alce_lab'
postgres={'POSTGRES_USER':'alce_lab','POSTGRES_PASSWORD':password,'POSTGRES_DB':'alce_lab'}
api={'DATABASE_URL':database,'NODE_ENV':'development','YATRI_DRIVER_PILOT_MODE':'true',
 'YATRI_DRIVER_PILOT_UNTIL':(datetime.now(timezone.utc)+timedelta(days=6)).isoformat(),
 'HOST':'0.0.0.0','PORT':'8082'}
for k in ['GOOGLE_MAPS_SERVER_KEY','GEOAPIFY_API_KEY','BASE_FARE_CENTS','PER_KM_CENTS']:
 if env.get(k):api[k]=env[k]
for name,data in [('postgres.env',postgres),('api.env',api)]:
 p=r/'private'/name;p.write_text(''.join(k+'='+v+'\n' for k,v in data.items()));p.chmod(0o600)
(r/'revision').write_text('8d24ad18edebe754341e7839261122b70a440777\n')
PY
docker network create --internal alce-lab >/dev/null
docker volume create alce-lab-postgres >/dev/null
docker run -d --name alce-lab-postgres --restart unless-stopped --network alce-lab \
  --memory 256m --cpus 0.5 --env-file "$root/private/postgres.env" \
  -v alce-lab-postgres:/var/lib/postgresql/data postgres:16-alpine >/dev/null
ready=false
for i in $(seq 1 30); do
  if docker exec alce-lab-postgres pg_isready -U alce_lab -d alce_lab >/dev/null 2>&1; then ready=true;break;fi
  sleep 1
done
test "$ready" = true
docker run --rm --network alce-lab --env-file "$root/private/api.env" \
  --entrypoint node "$image" src/migrate.mjs
# Transfer only the vehicle object over stdin; no plaintext profile on the server.
python3 - "$profile" <<'PY' | docker run --rm -i --network alce-lab --env-file "$root/private/api.env" --entrypoint node "$image" src/provision-driver-pilot.mjs /dev/stdin
import json,sys
p=json.load(open(sys.argv[1]))
assert p['name']=='Giselo'
v=p['vehicle'];v['plate']=v['plate'].replace('-','')
print(json.dumps(v))
PY
docker run --rm --network alce-lab --env-file "$root/private/api.env" \
  --entrypoint node "$image" src/provision-driver-pilot.mjs --passenger
# Second network grants provider egress; DB remains on the internal network.
docker run -d --name alce-lab-api --restart unless-stopped --network alce-lab \
  --memory 256m --cpus 0.5 --env-file "$root/private/api.env" \
  -p 127.0.0.1:8083:8082 --entrypoint node "$image" src/driver-pilot-server.mjs >/dev/null
docker network connect bridge alce-lab-api
ready=false
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:8083/health >/dev/null; then ready=true;break;fi
  sleep 1
done
test "$ready" = true
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8083/v1/snapshot)" = 401
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8083/v1/auth/register)" = 404
curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:8082/health >/dev/null
success=true
echo 'ALCE_ISOLATED_HEALTHY; SESSION_REQUIRED; EXISTING_SERVICES_HEALTHY; PUBLIC_PROXY_UNCHANGED'
