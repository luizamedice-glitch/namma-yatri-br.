#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Alce-specific configuration of the existing Namma backup engine; no restore."""
import importlib.util,json,re,shutil,sys
from pathlib import Path
from datetime import datetime,timezone

source=Path(__file__).with_name('namma-maintenance.py')
if not source.exists():source=Path(__file__).resolve().parent.parent/'maintenance.py'
spec=importlib.util.spec_from_file_location('namma_maintenance',source)
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
ROOT=Path('/opt/alce-lab')
engine.ROOT=ROOT;engine.BACKUPS=ROOT/'backups';engine.STATE=ROOT/'operations/state'

def live():
    # Select exact isolated containers. Never discover/modify the Namma compose DB.
    meta=json.loads(engine.docker('inspect','alce-lab-postgres'))[0]
    if not meta['State']['Running']:raise RuntimeError('ISOLATED_DATABASE_NOT_RUNNING')
    values=dict(v.split('=',1)for v in meta['Config']['Env']if '=' in v)
    database=values.get('POSTGRES_DB')
    user=values.get('POSTGRES_USER','postgres')
    if database!='alce_lab' or not re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_]*',user):
        raise RuntimeError('ISOLATED_DATABASE_REQUIRED')
    image=engine.docker('inspect','--format','{{.Image}}','alce-lab-compat')
    return meta['Id'],image,user,database

def monitor():
    engine.STATE.mkdir(parents=True,mode=0o700,exist_ok=True)
    checks={'api':engine.health('http://127.0.0.1:8083/health'),
            'diskSpace':shutil.disk_usage(ROOT).free>=512*1024*1024}
    try:live();checks['databaseContainer']=True
    except Exception:checks['databaseContainer']=False
    try:
        _,metadata=engine.latest(verify=True)
        checks['recentBackup']=0<=engine.age(metadata['createdAt'])<=26
    except Exception:checks['recentBackup']=False
    try:
        verified=json.loads((engine.STATE/'restore-check.json').read_text())
        checks['recentRestoreCheck']=0<=engine.age(verified['verifiedAt'])<=7*24
    except Exception:checks['recentRestoreCheck']=False
    try:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:8084/health',timeout=4)as response:
            checks['compat']=json.load(response).get('response',{}).get('status')=='ok'
    except Exception:checks['compat']=False
    report={'observedAt':datetime.now(timezone.utc).isoformat(),'healthy':all(checks.values()),'checks':checks}
    engine.atomic(engine.STATE/'health.json',report);return report

engine.live=live
engine.monitor=monitor
# Separate directory and exact container keep identically formatted backup names
# isolated. Reuse the upstream prefix for its own rotation/verification logic.
engine.NAME=re.compile(r'^yatri-db-[0-9]{8}T[0-9]{12}Z\.ybk$')
if __name__=='__main__':
    try:sys.exit(engine.main())
    except Exception as error:
        print(json.dumps({'maintenanceFailed':True,'reason':str(error)if isinstance(error,RuntimeError)else type(error).__name__}))
        sys.exit(1)
