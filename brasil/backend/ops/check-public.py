#!/usr/bin/env python3
"""Read-only check of the documented HTTPS boundary; no credentials required."""
import json
import urllib.error
import urllib.request

BASE = 'https://52-67-246-31.sslip.io'

def request(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=15) as response:
            return response.status, response.read(4096)
    except urllib.error.HTTPError as error:
        return error.code, b''

status, body = request('/health')
if status != 200 or json.loads(body) != {'status': 'ok', 'service': 'namma-yatri-br'}:
    raise SystemExit('Falha no health HTTPS')
for path in ['/v1/rides', '/v1/places/autocomplete', '/v1/development/session']:
    if request(path)[0] != 403:
        raise SystemExit('Fronteira HTTPS diverge da configuracao revisada: ' + path)
print('HTTPS: health 200 e rotas operacionais bloqueadas (403).')
