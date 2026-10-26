#!/usr/bin/env python3
"""Restore only into a fresh, disconnected disposable container. No target URL accepted."""
import json,os,subprocess,sys,time,uuid
from pathlib import Path

def verify(dump,migrations):
    name='yatri-restore-'+uuid.uuid4().hex
    env=dict(os.environ)
    for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
    def command(*args,**kwargs):
        return subprocess.run(['docker','--host=unix:///var/run/docker.sock',*args],env=env,capture_output=True,check=True,timeout=180,**kwargs)
    try:
        command('run','-d','--name',name,'--network','none','--label','yatri.isolated-restore=true','--memory','512m','--cpus','1','--pids-limit','128',
                '-e','POSTGRES_PASSWORD=isolated-restore-fixture','-e','POSTGRES_DB=isolated','postgres:16-alpine')
        for attempt in range(100):
            try:command('exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','isolated');break
            except subprocess.CalledProcessError:time.sleep(0.2)
        else:raise RuntimeError('ISOLATED_DATABASE_NOT_READY')
        with dump.open('rb') as stream:
            command('exec','-i',name,'pg_restore','-U','postgres','-d','isolated','--no-owner','--no-acl','--exit-on-error',stdin=stream)
        actual=command('exec',name,'psql','-X','-U','postgres','-d','isolated','-At','-v','ON_ERROR_STOP=1','-c','SELECT name FROM public.migrations ORDER BY name').stdout.decode().splitlines()
        expected=sorted(p.name for p in migrations.glob('*.sql'))
        if not expected or actual!=expected:raise RuntimeError('RESTORED_MIGRATIONS_MISMATCH')
        invalid=command('exec',name,'psql','-X','-U','postgres','-d','isolated','-At','-v','ON_ERROR_STOP=1','-c',
            "SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT i.indisvalid").stdout.strip()
        if invalid!=b'0':raise RuntimeError('RESTORED_INDEX_INVALID')
        return {'isolatedRestoreVerified':True,'migrationsMatch':True,'indexesValid':True,'liveDatabaseChanged':False}
    finally:
        try:command('rm','-f','-v',name)
        except Exception:pass

if __name__=='__main__':
    try:print(json.dumps(verify(Path(sys.argv[1]),Path(sys.argv[2]))))
    except Exception as error:
        # Never print pg_restore stderr: it may contain personal rows/SQL.
        print(json.dumps({'isolatedRestoreVerified':False,'reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__}));sys.exit(1)
