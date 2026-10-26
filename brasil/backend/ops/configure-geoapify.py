#!/usr/bin/env python3
"""Validate the supplied Geoapify key and atomically store it outside the application.
No running service, session, database or ride is changed by this command.
"""
import json,os,re,sys,tempfile
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode
root=Path('/opt/yatri-brasil/secrets');target=root/'geoapify.env'
try:
    key=sys.stdin.read().strip()
    if not re.fullmatch(r'[a-fA-F0-9]{32}',key):raise RuntimeError('INVALID_KEY_FORMAT')
    if not root.is_dir() or target.is_symlink():raise RuntimeError('INVALID_SECRET_PATH')
    query=urlencode({'lat':-23.5505,'lon':-46.6333,'lang':'pt','format':'json','apiKey':key})
    with urlopen('https://api.geoapify.com/v1/geocode/reverse?'+query,timeout=12) as response:
        data=json.load(response)
    result=(data.get('results') or [{}])[0]
    if not isinstance(result.get('formatted'),str):raise RuntimeError('PROVIDER_CHECK_FAILED')
    fd,name=tempfile.mkstemp(prefix='.geoapify-',dir=root)
    try:
        with os.fdopen(fd,'w') as stream:
            os.fchmod(stream.fileno(),0o600);stream.write('GEOAPIFY_API_KEY='+key+'\n');stream.flush();os.fsync(stream.fileno())
        os.replace(name,target)
    finally:
        if os.path.exists(name):os.unlink(name)
    print(json.dumps({'geoapifyConfigured':True,'providerVerified':True,'servicesRestarted':False}))
except Exception as error:
    print(json.dumps({'geoapifyConfigured':False,'reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__}))
    sys.exit(1)
