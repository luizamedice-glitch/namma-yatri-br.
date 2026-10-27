#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Instala somente a fachada Alce e rotas legadas; rollback preserva Namma."""
import hashlib,json,os,re,shutil,subprocess,sys,tarfile,tempfile,time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

ROOT=Path('/opt/alce-lab')
CADDY=Path('/etc/caddy/Caddyfile')
HOST='52-67-246-31.sslip.io'
IMAGE='yatri-driver-pilot:8d24ad18edebe754341e7839261122b70a440777'
BEGIN='# BEGIN ALCE LEGACY COMPAT'
END='# END ALCE LEGACY COMPAT'

def run(args,stdin=None):
    return subprocess.run(args,input=stdin,capture_output=True,text=True,check=True,timeout=120).stdout.strip()

def config(original):
    clean=re.sub(r'\n[ \t]*'+re.escape(BEGIN)+r'[\s\S]*?'+re.escape(END)+r'\n','\n',original)
    pattern=r'(?m)^([ \t]*(?:https://)?'+re.escape(HOST)+r'(?::443)?[ \t]*\{)'
    if len(re.findall(pattern,clean))!=1:raise RuntimeError('CADDY_HOST_NOT_UNIQUE')
    block='''
    # BEGIN ALCE LEGACY COMPAT
    @alceLegacy {
        path /api/* /taxista/* /taxi/* /solicitacao/* /solicitacao20/* /solicitacao30/* /configuracao /configuracao/* /passageiro/* /lab/* /geo/* /places/* /maps/api/*
    }
    handle @alceLegacy {
        reverse_proxy 127.0.0.1:8084
    }
    # END ALCE LEGACY COMPAT
'''
    return re.sub(pattern,lambda m:m.group(1)+block,clean,count=1)

def status(url,method='GET'):
    from urllib.request import Request
    try:
        with urlopen(Request(url,method=method,data=b'{}' if method=='POST' else None),timeout=10) as r:return r.status
    except HTTPError as e:return e.code

def main(bundle):
    if os.getuid()!=0 or not (ROOT/'private/api.env').exists():raise RuntimeError('ISOLATED_RUNTIME_REQUIRED')
    source=Path(bundle);digest=hashlib.sha256(source.read_bytes()).hexdigest()[:16]
    release=ROOT/'compat/releases'/digest
    if release.exists():raise RuntimeError('RELEASE_ALREADY_EXISTS')
    before=CADDY.read_text();candidate=config(before)
    release.mkdir(parents=True,mode=0o755)
    # No extraction of arbitrary tar names, symlinks, executables or traversal.
    with tarfile.open(source,'r:gz') as archive:
        for member in archive.getmembers():
            name=member.name
            if member.isdir():continue
            if not member.isfile() or '/' in name or name.startswith('.') or not name.endswith(('.mjs','.json','.env')):
                raise RuntimeError('UNEXPECTED_BUNDLE_MEMBER')
            target=release/name
            with archive.extractfile(member) as stream:target.write_bytes(stream.read())
            target.chmod(0o600 if name.endswith('.env') else 0o644)
    runtime=release/'runtime.env'
    env=(ROOT/'private/api.env').read_text()+runtime.read_text()+'\nALCE_ISOLATED_MODE=true\nALCE_LEGACY_PORT=8084\n'
    runtime.write_text(env);runtime.chmod(0o600)
    # Server modules expect source beside one another in /app/alce-compat.
    for name in ['server.mjs','http.mjs','models.mjs','ids.mjs','model-defaults.json','maps.mjs','geocoding.mjs']:
        if not (release/name).is_file():raise RuntimeError('BUNDLE_INCOMPLETE')
    candidate_file=ROOT/'private/Caddyfile.compat-candidate';candidate_file.write_text(candidate);candidate_file.chmod(0o600)
    run(['caddy','validate','--config',str(candidate_file),'--adapter','caddyfile'])
    previous=run(['docker','ps','-a','--filter','name=^alce-lab-compat$','--format','{{.ID}}'])
    if run(['docker','ps','-a','--filter','name=^alce-lab-compat-before$','--format','{{.ID}}']):raise RuntimeError('PREVIOUS_BACKUP_CONTAINER_EXISTS')
    changed=False
    try:
        if previous:
            run(['docker','stop','alce-lab-compat']);run(['docker','rename','alce-lab-compat','alce-lab-compat-before'])
        run(['docker','run','-d','--name','alce-lab-compat','--restart','unless-stopped','--network','alce-lab',
             '--memory','256m','--cpus','0.5','--env-file',str(runtime),'-p','127.0.0.1:8084:8084',
             '-v',str(release)+':/app/alce-compat:ro',
             '-v',str(release/'maps.mjs')+':/app/src/maps.mjs:ro',
             '-v',str(release/'geocoding.mjs')+':/app/src/geocoding.mjs:ro','--entrypoint','node',IMAGE,'/app/alce-compat/server.mjs'])
        run(['docker','network','connect','bridge','alce-lab-compat'])
        for attempt in range(20):
            try:
                if status('http://127.0.0.1:8084/health')==200:break
            except OSError:pass
            time.sleep(1)
        else:raise RuntimeError('COMPAT_UNHEALTHY')
        if status('http://127.0.0.1:8084/taxi/status','POST')!=401:raise RuntimeError('AUTH_GUARD_FAILED')
        backup=ROOT/'private/Caddyfile.before-compat';backup.write_text(before);backup.chmod(0o600)
        CADDY.write_text(candidate);changed=True
        run(['systemctl','reload','caddy'])
        if status('https://'+HOST+'/taxi/status','POST')!=401:raise RuntimeError('HTTPS_AUTH_GUARD_FAILED')
        if status('https://'+HOST+'/configuracao/passageiro')!=200:raise RuntimeError('HTTPS_BOOTSTRAP_FAILED')
        if status('https://'+HOST+'/v1/auth/register','POST')!=403:raise RuntimeError('NAMMA_PROXY_CHANGED')
        for port in [8080,8082,8083]:
            if status('http://127.0.0.1:'+str(port)+'/health')!=200:raise RuntimeError('EXISTING_SERVICE_UNHEALTHY')
        # Acceptance prints only booleans, never login bodies or session material.
        try:
            print(run(['docker','exec','alce-lab-compat','node','/app/alce-compat/verify-https.mjs']))
        except subprocess.CalledProcessError as error:
            print(error.stderr[-4000:],file=sys.stderr)
            raise
        if previous:run(['docker','rm','alce-lab-compat-before'])
        (ROOT/'compat/current-release').write_text(digest+'\n')
        activation=ROOT/'ativar'
        activation.write_text('#!/bin/sh\nset -eu\nexec docker exec alce-lab-compat node /app/alce-compat/activate.mjs\n')
        activation.chmod(0o700)
        print(json.dumps({'compatHealthy':True,'httpsSessionRequired':True,'bootstrapAvailable':True,'nammaServicesPreserved':True,'release':digest}))
    except Exception:
        if changed:CADDY.write_text(before);run(['systemctl','reload','caddy'])
        subprocess.run(['docker','rm','-f','alce-lab-compat'],capture_output=True)
        if previous:
            run(['docker','rename','alce-lab-compat-before','alce-lab-compat']);run(['docker','start','alce-lab-compat'])
        raise

if __name__=='__main__':
    try:main(sys.argv[1])
    except Exception:
        print('COMPAT_DEPLOY_FAILED: deployment aborted or rolled back; inspect private service status.',file=sys.stderr)
        sys.exit(1)
