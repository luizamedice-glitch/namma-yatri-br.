#!/usr/bin/env python3
"""Install reversible operations timers; never stops or restores the live database."""
import hashlib,json,os,re,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path('/opt/yatri-brasil')
def run(*args):return subprocess.run(args,capture_output=True,check=True,text=True,timeout=30).stdout.strip()
def write(path,data,mode=0o600):
    fd,tmp=tempfile.mkstemp(prefix='.maintenance-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:os.fchmod(f.fileno(),mode);f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def main(source,sha,recipient):
    if not re.fullmatch('[a-f0-9]{40}',sha):raise RuntimeError('INVALID_REVISION')
    # This file is public key material only. Private SSH key stays in Actions/the operator.
    run('openssl','pkey','-pubin','-in',str(recipient),'-noout')
    target=ROOT/'secrets/backup-recipient.pem'
    if target.exists() and target.read_bytes()!=recipient.read_bytes():raise RuntimeError('BACKUP_RECIPIENT_CHANGE_REQUIRES_REVIEW')
    for name in ['operations','operations/revisions','operations/state','backups']:(ROOT/name).mkdir(parents=True,mode=0o700,exist_ok=True)
    revision=ROOT/'operations/revisions'/sha;revision.mkdir(mode=0o700,exist_ok=True)
    for name in ['maintenance.py','backup-crypto.mjs']:
        data=(source/name).read_bytes();destination=revision/name
        if destination.exists() and destination.read_bytes()!=data:raise RuntimeError('REVISION_CONTENT_CHANGED')
        write(destination,data)
    write(target,recipient.read_bytes())
    current=ROOT/'operations/current';pending=ROOT/'operations/.current-new'
    pending.unlink(missing_ok=True);pending.symlink_to(revision);os.replace(pending,current)
    units={}
    for operation in ['backup','monitor']:
        units['yatri-'+operation+'.service']='''[Unit]
Description=Yatri private '''+operation+'''
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/bin/python3 /opt/yatri-brasil/operations/current/maintenance.py '''+operation+'''
TimeoutStartSec=180
Nice=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/yatri-brasil/backups /opt/yatri-brasil/operations/state
'''
    units['yatri-backup.timer']='''[Unit]
Description=Yatri encrypted backup daily
[Timer]
OnCalendar=*-*-* 03:15:00 UTC
Persistent=true
RandomizedDelaySec=60
[Install]
WantedBy=timers.target
'''
    units['yatri-monitor.timer']='''[Unit]
Description=Yatri local health check every five minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
'''
    for name,data in units.items():write(Path('/etc/systemd/system')/name,data.encode(),0o644)
    run('systemctl','daemon-reload')
    run('systemctl','enable','--now','yatri-backup.timer','yatri-monitor.timer')
    print(json.dumps({'maintenanceInstalled':True,'revision':sha,'backupTimer':run('systemctl','is-active','yatri-backup.timer')=='active','monitorTimer':run('systemctl','is-active','yatri-monitor.timer')=='active','privateKeyStoredOnServer':False}))
if __name__=='__main__':
    try:main(Path(sys.argv[1]),sys.argv[2],Path(sys.argv[3]))
    except Exception as error:
        print(json.dumps({'maintenanceInstalled':False,'reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__}));sys.exit(1)
