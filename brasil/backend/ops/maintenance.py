#!/usr/bin/env python3
"""Private, non-destructive live operations. There is deliberately no restore command."""
import fcntl,hashlib,json,os,re,shutil,subprocess,sys,tempfile
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import urlopen

ROOT=Path('/opt/yatri-brasil')
BACKUPS=ROOT/'backups';STATE=ROOT/'operations/state'
NAME=re.compile(r'^yatri-db-[0-9]{8}T[0-9]{12}Z\.ybk$')
def run(args,timeout=30):
    return subprocess.run(args,capture_output=True,check=True,timeout=timeout,text=True).stdout.strip()
def docker(*args):return run(['docker','--host=unix:///var/run/docker.sock',*args])
def atomic(path,value):
    fd,tmp=tempfile.mkstemp(prefix='.pending-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:os.fchmod(f.fileno(),0o600);f.write(json.dumps(value)+'\n');f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def live():
    api=docker('compose','-f',str(ROOT/'compose.yaml'),'ps','-q','api')
    meta=json.loads(docker('inspect',api))[0]
    project=meta['Config']['Labels']['com.docker.compose.project']
    db=docker('ps','-q','--filter','label=com.docker.compose.project='+project,'--filter','label=com.docker.compose.service=postgres')
    if not re.fullmatch('[a-f0-9]{12,64}',db):raise RuntimeError('DATABASE_NOT_UNIQUE')
    env=dict(v.split('=',1) for v in json.loads(docker('inspect',db))[0]['Config']['Env'] if '=' in v)
    return db,meta['Image'],env.get('POSTGRES_USER','postgres'),env.get('POSTGRES_DB',env.get('POSTGRES_USER','postgres'))
def checksum(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''):digest.update(chunk)
    return digest.hexdigest()
def latest(verify=False):
    files=sorted(p for p in BACKUPS.glob('yatri-db-*.ybk') if NAME.fullmatch(p.name) and not p.is_symlink())
    if not files:raise RuntimeError('BACKUP_MISSING')
    file=files[-1];metadata=json.loads(file.with_suffix('.json').read_text())
    if metadata['file']!=file.name or metadata['bytes']!=file.stat().st_size:raise RuntimeError('BACKUP_METADATA_INVALID')
    if verify and checksum(file)!=metadata['sha256']:raise RuntimeError('BACKUP_CHECKSUM_FAILED')
    return file,metadata
def backup():
    for directory in [BACKUPS,STATE]:directory.mkdir(parents=True,mode=0o700,exist_ok=True)
    with (STATE/'backup.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if shutil.disk_usage(ROOT).free<512*1024*1024:raise RuntimeError('LOW_DISK_SPACE')
        db,image,user,database=live()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}',image):raise RuntimeError('RUNTIME_IMAGE_INVALID')
        name='yatri-db-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.ybk'
        partial=BACKUPS/('.incomplete-'+name);final=BACKUPS/name
        dump=crypto=None
        try:
            dump=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','--user','postgres',db,'pg_dump','-U',user,'-d',database,'-Fc','--no-owner','--no-acl','--no-password'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            script=Path(__file__).resolve().parent/'backup-crypto.mjs'
            crypto=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','run','--rm','-i','--pull','never','--network','none','--read-only','--no-healthcheck','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--cpus','0.25','--pids-limit','64','--user','0:0',
                '--mount','type=bind,src='+str(script)+',dst=/task/crypto.mjs,readonly',
                '--mount','type=bind,src='+str(ROOT/'secrets/backup-recipient.pem')+',dst=/task/recipient.pem,readonly',
                '--mount','type=bind,src='+str(BACKUPS)+',dst=/output',
                image,'node','/task/crypto.mjs','encrypt','/task/recipient.pem','/output/'+partial.name],stdin=dump.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            dump.stdout.close()
            code=crypto.wait(timeout=150);source=dump.wait(timeout=15)
            if code or source or not partial.is_file() or partial.stat().st_size<100:raise RuntimeError('BACKUP_COMMAND_FAILED')
            partial.chmod(0o600);os.replace(partial,final)
            metadata={'file':name,'createdAt':datetime.now(timezone.utc).isoformat(),'bytes':final.stat().st_size,'sha256':checksum(final),'encrypted':True}
            atomic(final.with_suffix('.json'),metadata)
            # Rotate only our own named files after a complete new encrypted dump.
            files=sorted(p for p in BACKUPS.glob('yatri-db-*.ybk') if NAME.fullmatch(p.name) and not p.is_symlink())
            for old in files[:-7]:old.unlink();old.with_suffix('.json').unlink(missing_ok=True)
            return {'backupCreated':True,'file':name,'bytes':metadata['bytes'],'encrypted':True}
        finally:
            for process in [crypto,dump]:
                if process and process.poll() is None:process.kill();process.wait()
            partial.unlink(missing_ok=True)
def health(url):
    try:
        with urlopen(url,timeout=4) as response:return response.status==200 and json.load(response).get('status')=='ok'
    except Exception:return False
def age(value):return (datetime.now(timezone.utc)-datetime.fromisoformat(value)).total_seconds()/3600
def monitor():
    STATE.mkdir(parents=True,mode=0o700,exist_ok=True)
    checks={'api':health('http://127.0.0.1:8080/health'),'driverPilot':health('http://127.0.0.1:8082/health'),'diskSpace':shutil.disk_usage(ROOT).free>=512*1024*1024}
    try:
        _,_,_,_=live();checks['databaseContainer']=True
    except Exception:checks['databaseContainer']=False
    try:
        _,metadata=latest();checks['recentBackup']=0<=age(metadata['createdAt'])<=26
    except Exception:checks['recentBackup']=False
    try:
        verified=json.loads((STATE/'restore-check.json').read_text());checks['recentOffsiteRestoreCheck']=0<=age(verified['verifiedAt'])<=26
    except Exception:checks['recentOffsiteRestoreCheck']=False
    try:
        config=json.loads((ROOT/'compose.driver-pilot.json').read_text())
        until=config['services']['driver-pilot']['environment']['YATRI_DRIVER_PILOT_UNTIL']
        checks['pilotWindow']=datetime.fromisoformat(until.replace('Z','+00:00'))>datetime.now(timezone.utc)
    except Exception:checks['pilotWindow']=False
    report={'observedAt':datetime.now(timezone.utc).isoformat(),'healthy':all(checks.values()),'checks':checks}
    atomic(STATE/'health.json',report);return report
def main():
    os.umask(0o077);operation=sys.argv[1]
    if operation=='backup':result=backup()
    elif operation=='monitor':result=monitor()
    elif operation=='export':
        try:
            _,metadata=latest(verify=True)
            if age(metadata['createdAt'])>1:backup()
        except (RuntimeError,FileNotFoundError,ValueError,KeyError):backup()
        _,result=latest(verify=True)
    elif operation=='verified':
        name,digest=sys.argv[2:4]
        if not NAME.fullmatch(name) or not re.fullmatch('[a-f0-9]{64}',digest):raise RuntimeError('INVALID_VERIFICATION')
        file=BACKUPS/name
        if file.is_symlink() or checksum(file)!=digest:raise RuntimeError('VERIFICATION_MISMATCH')
        result={'verifiedAt':datetime.now(timezone.utc).isoformat(),'file':name,'sha256':digest}
        atomic(STATE/'restore-check.json',result)
    else:raise RuntimeError('INVALID_OPERATION')
    print(json.dumps(result))
    return 1 if operation=='monitor' and not result['healthy'] else 0
if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:
        print(json.dumps({'maintenanceFailed':True,'reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__}))
        sys.exit(1)
