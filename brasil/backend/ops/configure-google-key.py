#!/usr/bin/env python3
"""Recebe a chave por stdin, atualiza a API existente e testa Google sem logar segredos."""
import base64
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path('/opt/yatri-brasil')
ENV = ROOT / 'secrets/backend.env'


def atomic_write(path, content, owner):
    fd, name = tempfile.mkstemp(prefix='.google-key-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            os.fchown(stream.fileno(), owner.st_uid, owner.st_gid)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def restart_api():
    subprocess.run(
        ['docker', 'compose', '-f', str(ROOT / 'compose.yaml'), 'up', '-d',
         '--no-deps', '--no-build', '--force-recreate', 'api'],
        cwd=ROOT, capture_output=True, check=True, timeout=100)


def health():
    for _ in range(25):
        try:
            with urlopen('http://127.0.0.1:8080/health', timeout=3) as response:
                if response.status == 200 and json.load(response).get('status') == 'ok':
                    return True
        except (URLError, OSError, ValueError):
            pass
        time.sleep(1)
    return False


def google(key, name, url, mask, payload=None):
    request = Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
                               'X-Goog-FieldMask': mask})
    try:
        with urlopen(request, timeout=15) as response:
            data = json.load(response)
        print(json.dumps({'googleApi': name, 'httpStatus': 200}), flush=True)
        return data
    except HTTPError as error:
        reasons = []
        try:
            details = json.loads(error.read()).get('error', {}).get('details', [])
            reasons = [d['reason'] for d in details if re.fullmatch(r'[A-Z0-9_]+', d.get('reason', ''))]
        except (ValueError, TypeError):
            pass
        print(json.dumps({'googleApi': name, 'httpStatus': error.code, 'reasons': reasons}), flush=True)
    except (URLError, OSError, ValueError):
        print(json.dumps({'googleApi': name, 'error': 'NETWORK_OR_RESPONSE_ERROR'}), flush=True)
    return None


def main():
    key = sys.stdin.read().strip()
    if not re.fullmatch(r'AIza[A-Za-z0-9_-]{35}', key):
        sys.exit('Formato da chave Google inválido; nenhuma configuração alterada.')
    if ENV.is_symlink() or not ENV.is_file():
        sys.exit('Arquivo de configuração esperado ausente ou não regular.')
    if 'secrets/backend.env' not in (ROOT / 'compose.yaml').read_text():
        sys.exit('Compose não referencia o arquivo de ambiente esperado; alteração recusada.')
    owner = ENV.stat()
    if not stat.S_ISREG(owner.st_mode):
        sys.exit('Arquivo de configuração não regular.')
    original = ENV.read_bytes()
    lines = original.decode().splitlines()
    entry = 'GOOGLE_MAPS_SERVER_KEY=' + key
    updated = [line for line in lines if not re.match(r'^\s*GOOGLE_MAPS_SERVER_KEY\s*=', line)]
    updated.append(entry)
    content = ('\n'.join(updated) + '\n').encode()
    changed = content != original
    if changed:
        fd, backup = tempfile.mkstemp(prefix='.backend.pre-google-', dir=ENV.parent)
        with os.fdopen(fd, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(original)
        try:
            atomic_write(ENV, content, owner)
            restart_api()
            if not health():
                raise RuntimeError('HEALTH_FAILED')
        except Exception:
            atomic_write(ENV, original, owner)
            try:
                restart_api()
                restored = health()
            except Exception:
                restored = False
            print(json.dumps({'configurationApplied': False, 'rollbackHealthy': restored}), flush=True)
            sys.exit(1)
    elif not health():
        sys.exit('API sem saúde antes da verificação; configuração preservada.')
    # Confirma que o processo em execução recebeu a configuração, sem mostrar valor.
    result = subprocess.run(
        ['docker', 'compose', '-f', str(ROOT / 'compose.yaml'), 'exec', '-T', 'api',
         'node', '-e', 'process.stdout.write(String(Boolean(process.env.GOOGLE_MAPS_SERVER_KEY)))'],
        cwd=ROOT, capture_output=True, text=True, check=True, timeout=15)
    configured = result.stdout.strip() == 'true'
    print(json.dumps({'configurationChanged': changed, 'apiHealthy': True,
                      'googleMapsConfigured': configured}), flush=True)
    suggestions = google(key, 'PlacesAutocomplete', 'https://places.googleapis.com/v1/places:autocomplete',
                         'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
                         {'input': 'Avenida Paulista São Paulo', 'languageCode': 'pt-BR',
                          'regionCode': 'BR', 'includedRegionCodes': ['br']})
    details_ok = False
    if suggestions and suggestions.get('suggestions'):
        place_id = suggestions['suggestions'][0].get('placePrediction', {}).get('placeId')
        if place_id and re.fullmatch(r'[\w:-]{3,255}', place_id):
            data = google(key, 'PlacesDetails',
                          'https://places.googleapis.com/v1/places/' + place_id + '?languageCode=pt-BR',
                          'id,formattedAddress,location')
            details_ok = bool(data and data.get('location'))
    routes = google(key, 'Routes', 'https://routes.googleapis.com/directions/v2:computeRoutes',
                    'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
                    {'origin': {'location': {'latLng': {'latitude': -23.5614, 'longitude': -46.6559}}},
                     'destination': {'location': {'latLng': {'latitude': -23.5505, 'longitude': -46.6333}}},
                     'travelMode': 'DRIVE', 'routingPreference': 'TRAFFIC_AWARE',
                     'languageCode': 'pt-BR', 'units': 'METRIC'})
    routes_ok = bool(routes and routes.get('routes') and routes['routes'][0].get('distanceMeters', 0) > 0)
    print(json.dumps({'placesValidated': details_ok, 'routesValidated': routes_ok}), flush=True)
    if not (configured and details_ok and routes_ok):
        sys.exit(2)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError):
        sys.exit('Falha operacional; nenhum valor de credencial foi registrado.')
