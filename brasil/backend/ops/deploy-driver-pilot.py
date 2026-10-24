#!/usr/bin/env python3
"""Deploy the driver-only pilot without recreating API, maps or PostgreSQL."""
import fcntl, hashlib, json, os, re, subprocess, sys, tempfile, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

ROOT=Path('/opt/yatri-brasil')
CADDY=Path('/etc/caddy/Caddyfile')
HOST='52-67-246-31.sslip.io'
BEGIN='# BEGIN YATRI DRIVER PILOT'
END='# END YATRI DRIVER PILOT'

def run(args,timeout=120):
    # Never forward command output containing Docker environment values.
    run.last_command=args[:2]
    return subprocess.run(args,stdin=subprocess.DEVNULL,capture_output=True,text=True,check=True,timeout=timeout).stdout.strip()

def write(path,text,mode=0o600):
    fd,tmp=tempfile.mkstemp(prefix='.driver-pilot-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:
            os.fchmod(f.fileno(),mode);f.write(text);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def caddy_config(original):
    clean=re.sub(r'\n[ \t]*'+re.escape(BEGIN)+r'[\s\S]*?'+re.escape(END)+r'\n(?:[ \t]*\n)*', '\n', original)
    pattern=r'(?m)^([ \t]*(?:https://)?'+re.escape(HOST)+r'(?::443)?[ \t]*\{)'
    if len(re.findall(pattern,clean))!=1:raise RuntimeError('CADDY_HOST_NOT_UNIQUE')
    block='''
    # BEGIN YATRI DRIVER PILOT
    @yatriDriverSnapshot {
        method GET
        path /v1/snapshot
    }
    handle @yatriDriverSnapshot {
        reverse_proxy 127.0.0.1:8082
    }
    @yatriDriverUpdate {
        method POST
        path /v1/driver/location /v1/driver/availability
    }
    handle @yatriDriverUpdate {
        reverse_proxy 127.0.0.1:8082
    }
    # END YATRI DRIVER PILOT
'''
    return re.sub(pattern,lambda m:m.group(1)+block,clean,count=1)

def status(url,method='GET'):
    from urllib.request import Request
    try:
        with urlopen(Request(url,method=method,data=b'{}' if method=='POST' else None),timeout=10) as r:return r.status
    except HTTPError as e:return e.code

def main(source,sha):
    if not re.fullmatch('[a-f0-9]{40}',sha):raise RuntimeError('INVALID_REVISION')
    lock=open(ROOT/'.deploy.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    base=['docker','compose','-f',str(ROOT/'compose.yaml')]
    api=run(base+['ps','-q','api'])
    if not api:raise RuntimeError('API_NOT_RUNNING')
    metadata=json.loads(run(['docker','inspect',api]))[0]
    project=metadata['Config']['Labels']['com.docker.compose.project']
    networks=list(metadata['NetworkSettings']['Networks'])
    if len(networks)!=1:raise RuntimeError('DATABASE_NETWORK_NOT_UNIQUE')
    current_env=dict(v.split('=',1) for v in metadata['Config']['Env'] if '=' in v)
    if not current_env.get('DATABASE_URL'):raise RuntimeError('DATABASE_NOT_CONFIGURED')
    def service_id(name):
        return run(['docker','ps','-q','--filter','label=com.docker.compose.project='+project,
            '--filter','label=com.docker.compose.service='+name])
    before={name:service_id(name) for name in ['api','postgres','maps-test']}
    # No migration command is run. Require byte-identical SQL first.
    hashes=json.loads(run(['docker','exec',api,'node','-e',
        'const fs=require("fs"),c=require("crypto");console.log(JSON.stringify(Object.fromEntries(fs.readdirSync("/app/migrations").filter(n=>n.endsWith(".sql")).sort().map(n=>[n,c.createHash("sha256").update(fs.readFileSync("/app/migrations/"+n)).digest("hex")]))));']))
    expected={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((source/'migrations').glob('*.sql'))}
    if hashes!=expected:raise RuntimeError('MIGRATIONS_DIFFER')
    image='yatri-driver-pilot:'+sha
    run(['docker','build','--build-arg','YATRI_REVISION='+sha,'-t',image,str(source)],timeout=240)
    env=ROOT/'secrets/driver-pilot.env';override=ROOT/'compose.driver-pilot.json'
    work=ROOT/'driver-pilot';work.mkdir(mode=0o700,exist_ok=True)
    until=(datetime.now(timezone.utc)+timedelta(days=7)-timedelta(minutes=1)).isoformat()
    config={'services':{'driver-pilot':{
        'image':image,'entrypoint':['node','src/driver-pilot-server.mjs'],'command':[],
        'env_file':[str(env)],'environment':{'NODE_ENV':'development','HOST':'0.0.0.0','PORT':'8082',
            'YATRI_DRIVER_PILOT_MODE':'true','YATRI_DRIVER_PILOT_UNTIL':until},
        'ports':['127.0.0.1:8082:8082'],'networks':['driver_existing'],'restart':'unless-stopped',
        'read_only':True,'cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],
        'mem_limit':'256m','cpus':0.5,
        'logging':{'driver':'json-file','options':{'max-size':'5m','max-file':'2'}}
    }},'networks':{'driver_existing':{'external':True,'name':networks[0]}}}
    dc=['docker','compose','--project-name',project,'-f',str(ROOT/'compose.yaml'),'-f',str(override)]
    original=CADDY.read_text();mode=CADDY.stat().st_mode&0o777
    previous={p:p.read_text() if p.exists() else None for p in [env,override]}
    candidate=caddy_config(original)
    try:
        write(env,'DATABASE_URL='+json.dumps(current_env['DATABASE_URL'])+'\n')
        write(override,json.dumps(config)+'\n')
        write(work/'Caddyfile.candidate',candidate)
        run(['caddy','validate','--config',str(work/'Caddyfile.candidate'),'--adapter','caddyfile'])
        run(dc+['up','-d','--no-deps','--no-build','--pull','never','driver-pilot'])
        for attempt in range(25):
            try:
                if status('http://127.0.0.1:8082/health')==200:break
            except OSError:pass
            time.sleep(1)
        else:raise RuntimeError('DRIVER_PILOT_UNHEALTHY')
        write(work/'Caddyfile.before-driver-pilot',original)
        write(CADDY,candidate,mode);run(['systemctl','reload','caddy'])
        for method,path in [('GET','/v1/snapshot'),('POST','/v1/driver/location'),('POST','/v1/driver/availability')]:
            if status('https://'+HOST+path,method)!=401:raise RuntimeError('AUTH_BOUNDARY_FAILED')
        for method,path in [('POST','/v1/auth/register'),('POST','/v1/development/session'),('POST','/v1/rides'),('GET','/v1/events')]:
            if status('https://'+HOST+path,method)!=403:raise RuntimeError('UNRELATED_ROUTE_EXPOSED')
        if status('https://'+HOST+'/health')!=200:raise RuntimeError('MAIN_HEALTH_FAILED')
        if before!={name:service_id(name) for name in before}:raise RuntimeError('EXISTING_SERVICES_CHANGED')
        print(json.dumps({'driverPilotDeployed':True,'revision':sha,'expiresAt':until,
            'anonymousOperationsRejected':True,'unrelatedRoutesBlocked':True,'existingServicesUnchanged':True,
            'authenticatedAndroidAcceptance':'pending_provisioning'}))
    except Exception:
        write(CADDY,original,mode)
        try:run(['systemctl','reload','caddy']);run(dc+['stop','driver-pilot'])
        except Exception:pass
        for p,value in previous.items():
            if value is None:p.unlink(missing_ok=True)
            else:write(p,value)
        if previous[override] is not None:
            try:run(dc+['up','-d','--no-deps','--no-build','--pull','never','driver-pilot'])
            except Exception:pass
        raise

if __name__=='__main__':
    try:main(Path(sys.argv[1]),sys.argv[2])
    except Exception as e:
        # Subprocess errors may include environment arguments: never print them.
        print(json.dumps({'driverPilotDeployed':False,'reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,
            'command':getattr(run,'last_command',[])}),file=sys.stderr)
        sys.exit(1)
