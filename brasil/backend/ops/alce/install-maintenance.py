#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Install Alce-only encrypted backup/monitor timers. Never restore a live DB."""
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
ROOT=Path('/opt/alce-lab')

def unit(operation):
    return f'''[Unit]
Description=Alce isolated {operation}
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
UMask=0077
PrivateTmp=true
NoNewPrivileges=true
TimeoutStartSec=240
ExecStart=/usr/bin/python3 /opt/alce-lab/operations/current/maintenance.py {operation}
'''

def timer(operation):
    schedule='OnCalendar=*-*-* 03:30:00 UTC\nPersistent=true' if operation=='backup' else 'OnBootSec=5min\nOnUnitActiveSec=5min'
    return f'''[Unit]
Description=Alce isolated {operation} schedule
[Timer]
{schedule}
Unit=alce-{operation}.service
[Install]
WantedBy=timers.target
'''

def install(source):
    if os.geteuid()!=0 or not (ROOT/'private/api.env').is_file():raise RuntimeError('ISOLATED_RUNTIME_REQUIRED')
    # Source is our reviewed checkout, copied over existing authorized SSH.
    files={
      'maintenance.py':source/'alce/maintenance.py',
      'namma-maintenance.py':source/'maintenance.py',
      'backup-crypto.mjs':source/'backup-crypto.mjs',
    }
    digest=hashlib.sha256(b''.join(p.read_bytes()for p in files.values())).hexdigest()[:16]
    release=ROOT/'operations/releases'/digest
    release.mkdir(parents=True,mode=0o700,exist_ok=True)
    for name,path in files.items():
        dest=release/name;dest.write_bytes(path.read_bytes());dest.chmod(0o600)
    for name in ['backups','operations/state','secrets']:(ROOT/name).mkdir(parents=True,mode=0o700,exist_ok=True)
    recipient=ROOT/'secrets/backup-recipient.pem'
    public=Path('/opt/yatri-brasil/secrets/backup-recipient.pem')
    if recipient.exists() and recipient.read_bytes()!=public.read_bytes():raise RuntimeError('RECIPIENT_CHANGE_REFUSED')
    shutil.copyfile(public,recipient);recipient.chmod(0o600)
    current=ROOT/'operations/current';pending=ROOT/'operations/.current-pending'
    pending.unlink(missing_ok=True);pending.symlink_to(release);pending.replace(current)
    for operation in ['backup','monitor']:
        for extension,content in [('service',unit(operation)),('timer',timer(operation))]:
            path=Path('/etc/systemd/system')/f'alce-{operation}.{extension}'
            path.write_text(content);path.chmod(0o644)
    subprocess.run(['systemctl','daemon-reload'],check=True,capture_output=True)
    # Qualify the actual encrypted snapshot before enabling the daily job.
    result=subprocess.run(['python3',str(current/'maintenance.py'),'backup'],check=True,capture_output=True,text=True,timeout=210)
    metadata=json.loads(result.stdout);assert metadata['backupCreated'] and metadata['encrypted']
    subprocess.run(['systemctl','enable','--now','alce-backup.timer','alce-monitor.timer'],check=True,capture_output=True)
    print(json.dumps({'alceBackupInstalled':True,'dailyEncryptedBackup':True,'monitorEveryFiveMinutes':True,'nammaTimersChanged':False,'release':digest}))

if __name__=='__main__':
    try:install(Path(sys.argv[1]))
    except Exception as error:
        print(json.dumps({'alceMaintenanceInstallFailed':True,'reason':str(error)if isinstance(error,RuntimeError)else type(error).__name__}))
        sys.exit(1)
