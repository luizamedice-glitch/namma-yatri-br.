#!/usr/bin/env python3
"""Instala somente o motor anônimo de mapas; preserva API/banco e restaura Caddy em falha."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path('/opt/yatri-brasil')
CADDY = Path('/etc/caddy/Caddyfile')
HOST = '52-67-246-31.sslip.io'
BEGIN = '# BEGIN YATRI MAPS TEST'
END = '# END YATRI MAPS TEST'


def caddy_config(original):
    clean = re.sub(r'\n[ \t]*' + re.escape(BEGIN) + r'[\s\S]*?' + re.escape(END) + r'\n(?:[ \t]*\n)*', '\n', original)
    pattern = r'(?m)^([ \t]*(?:https://)?' + re.escape(HOST) + r'(?::443)?[ \t]*\{)'
    if len(re.findall(pattern, clean)) != 1:
        raise RuntimeError('CADDY_HOST_BLOCK_NOT_UNIQUE')
    block = '''
    # BEGIN YATRI MAPS TEST
    @yatriMapsTest {
        method POST
        path /v1/test/places/autocomplete /v1/test/places/details /v1/test/routes
    }
    handle @yatriMapsTest {
        reverse_proxy 127.0.0.1:8081
    }
    # END YATRI MAPS TEST
'''
    return re.sub(pattern, lambda m: m.group(1) + block, clean, count=1)


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=90, **kwargs).stdout.strip()


def write(path, content, mode=0o600):
    fd, temp = tempfile.mkstemp(prefix='.maps-test-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def request(url, body=None):
    req = Request(url, data=json.dumps(body).encode() if body is not None else None,
                  headers={'Content-Type':'application/json'})
    with urlopen(req, timeout=18) as response:
        return json.load(response)


def main(source):
    lock = open(ROOT / '.maps-test.lock', 'w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    original = CADDY.read_text()
    candidate = caddy_config(original)
    work = ROOT / 'test-engine'
    work.mkdir(mode=0o755, exist_ok=True)
    target = work / 'maps-test-server.mjs'
    env = ROOT / 'secrets/maps-test.env'
    override = ROOT / 'compose.maps-test.json'
    # O serviço separado recebe só a chave Google; nenhuma credencial de banco.
    match = re.search(r'(?m)^GOOGLE_MAPS_SERVER_KEY=([A-Za-z0-9_-]+)\s*$', (ROOT/'secrets/backend.env').read_text())
    if not match:
        raise RuntimeError('GOOGLE_KEY_NOT_CONFIGURED')
    dc = ['docker','compose','-f',str(ROOT/'compose.yaml')]
    api_id = run(dc + ['ps','-q','api'])
    image = run(['docker','inspect','--format','{{.Image}}',api_id])
    project = run(['docker','inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}',api_id])
    dc = ['docker','compose','--project-name',project,'-f',str(ROOT/'compose.yaml'),'-f',str(override)]
    until = (datetime.now(timezone.utc) + timedelta(days=7) - timedelta(seconds=10)).isoformat()
    config = {'services':{'maps-test':{
        'image':image, 'entrypoint':['node','/app/maps-test-server.mjs'], 'command':[],
        'env_file':[str(env)], 'environment':{'NODE_ENV':'development','HOST':'0.0.0.0','PORT':'8081',
            'YATRI_MAPS_TEST_MODE':'true','YATRI_MAPS_TEST_UNTIL':until},
        'volumes':[str(target)+':/app/maps-test-server.mjs:ro'], 'ports':['127.0.0.1:8081:8081'],
        'networks':['maps_test'], 'restart':'unless-stopped', 'read_only':True,
        'cap_drop':['ALL'], 'security_opt':['no-new-privileges:true'], 'mem_limit':'192m', 'cpus':0.5,
        'logging':{'driver':'json-file','options':{'max-size':'5m','max-file':'2'}}
    }},'networks':{'maps_test':{}}}
    previous = {p:p.read_bytes() if p.exists() else None for p in [target,env,override]}
    caddy_mode = CADDY.stat().st_mode & 0o777
    api_before = api_id
    try:
        write(target, Path(source).read_text(), 0o644)
        write(env, 'GOOGLE_MAPS_SERVER_KEY='+match.group(1)+'\n')
        write(override,json.dumps(config)+'\n')
        validate_file = work / 'Caddyfile.candidate'
        write(validate_file,candidate,0o644)
        run(['caddy','validate','--config',str(validate_file),'--adapter','caddyfile'])
        run(dc + ['up','-d','--no-deps','--no-build','--pull','never','maps-test'])
        for attempt in range(20):
            try:
                if request('http://127.0.0.1:8081/health').get('active'):
                    break
            except (URLError,OSError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError('TEST_ENGINE_UNHEALTHY')
        write(work/'Caddyfile.before-maps-test',original,0o600)
        write(CADDY,candidate,caddy_mode)
        run(['systemctl','reload','caddy'])
        base='https://'+HOST
        suggestions=request(base+'/v1/test/places/autocomplete',{'input':'Avenida Paulista São Paulo'})
        place_id=suggestions['suggestions'][0]['placeId']
        details=request(base+'/v1/test/places/details',{'placeId':place_id})
        routes=request(base+'/v1/test/routes',{'origin':{'lat':-23.5614,'lng':-46.6559},
                                             'destination':{'lat':-23.5505,'lng':-46.6333}})
        assert details.get('location') and routes['routes'][0]['distanceMeters']>0
        for path in ['/v1/rides','/v1/auth/register','/v1/development/session']:
            try:
                request(base+path,{})
            except HTTPError as error:
                assert error.code==403
            else:
                raise RuntimeError('OPERATIONAL_ROUTE_EXPOSED')
        api_after=run(['docker','compose','-f',str(ROOT/'compose.yaml'),'ps','-q','api'])
        assert api_before==api_after
        assert request(base+'/health')['status']=='ok'
        print(json.dumps({'mapsTestDeployed':True,'anonymousPlacesValidated':True,'anonymousRoutesValidated':True,
            'operationalRoutesBlocked':True,'mainApiUnchanged':True,'expiresAt':until}),flush=True)
    except Exception:
        write(CADDY,original,caddy_mode)
        try:
            run(['systemctl','reload','caddy'])
            run(dc+['stop','maps-test'])
        except subprocess.SubprocessError:
            pass
        for path, content in previous.items():
            if content is None:
                path.unlink(missing_ok=True)
            else:
                write(path,content.decode(),0o644 if path==target else 0o600)
        if previous[override] is not None:
            try:
                run(dc+['up','-d','--no-deps','--no-build','--pull','never','maps-test'])
            except subprocess.SubprocessError:
                pass
        print(json.dumps({'mapsTestDeployed':False,'caddyRestored':True}),flush=True)
        raise


if __name__ == '__main__':
    try:
        main(sys.argv[1])
    except Exception as error:
        # Não exibir stdout/stderr de Docker nem valores de configuração.
        print(json.dumps({'failed':True,'errorType':type(error).__name__}),file=sys.stderr)
        sys.exit(1)
