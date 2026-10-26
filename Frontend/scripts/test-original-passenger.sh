#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/android-original-evidence"
mkdir -p "$OUT"
mapfile -d '' APKS < <(find original-apk -name '*.apk' -print0)
[[ ${#APKS[@]} -eq 1 ]] || { echo 'Esperado exatamente um APK'; exit 1; }
sha256sum "${APKS[0]}" > "$OUT/apk.sha256"
adb install -g "${APKS[0]}"
adb shell svc wifi disable
adb shell svc data disable
adb logcat -c
python3 Frontend/scripts/capture-passenger-branding.py "$OUT"
timeout 60s adb shell am start -W -n in.juspay.nammayatri.debug/in.juspay.mobility.MainActivity > "$OUT/launch.txt"
# Captures distinguish a live splash from an interface that actually rendered.
ELAPSED=0
for stage in 10 50 110 120; do
  sleep "$((stage - ELAPSED))"
  ELAPSED=$stage
  adb exec-out screencap -p > "$OUT/screen-${stage}.png"
  adb shell rm -f /sdcard/window.xml
  timeout 20s adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$OUT/window-${stage}.xml" > /dev/null 2>&1 || true
  adb shell dumpsys activity activities > "$OUT/activity-${stage}.txt"
done
"$CDP_PYTHON" Frontend/scripts/inspect-original-webview.py "$OUT"
adb logcat -d > "$OUT/logcat.private"
python3 - "$OUT" <<'PY'
from pathlib import Path
import re, sys
out = Path(sys.argv[1])
raw = out / 'logcat.private'
text = raw.read_text(errors='replace')
text = re.sub(r'AIza[0-9A-Za-z_-]{20,}', '[REDACTED_GOOGLE_KEY]', text)
text = re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+', r'\1[REDACTED]', text)
text = re.sub(r'\b[a-fA-F0-9]{64}\b', '[REDACTED_SESSION_OR_HASH]', text)
(out / 'logcat.txt').write_text(text)
raw.unlink()
PY
# Verify completion of the solid-pink animation derived from the original MP4.
python3 - "$OUT" "${APKS[0]}" <<'PYVIDEO'
import hashlib, json, sys
from pathlib import Path
from zipfile import ZipFile
out = Path(sys.argv[1])
asset = 'assets/branding/alceyatri_abertura_original.mp4'
with ZipFile(sys.argv[2]) as apk:
    if asset in apk.namelist():
        expected = 'bf1ff534bcf0acc7aa9bb83a8a01c31ce3fa0d721ab8bf08666e45a7978c022c'
        actual = hashlib.sha256(apk.read(asset)).hexdigest()
        log = (out / 'logcat.txt').read_text()
        completed = 'YatriBrandSplash: opening_completed' in log
        errors = 'YatriBrandSplash: opening_asset_error' in log
        animation = apk.read('assets/branding/br_abertura.gif')
        result = {'original_video_sha256': actual, 'original_bytes_preserved': actual == expected,
                  'playback_completed': completed, 'playback_error': errors,
                  'rendered_asset': 'assets/branding/br_abertura.gif',
                  'rendered_asset_sha256': hashlib.sha256(animation).hexdigest(),
                  'evidence': 'branding-start.mp4', 'visual_review_required': True}
        (out / 'branding-video.json').write_text(json.dumps(result, indent=2) + '\n')
        if actual != expected or not completed or errors:
            raise SystemExit('FALHA: abertura rosa não concluiu; consultar branding-video.json')
PYVIDEO
if ! adb shell pidof in.juspay.nammayatri.debug > "$OUT/process.txt"; then
  echo 'FALHA: processo do passageiro encerrou durante o teste' | tee "$OUT/result.txt"
  exit 1
fi
if grep -q 'FATAL EXCEPTION' "$OUT/logcat.txt"; then
  echo 'FALHA: excecao fatal registrada; consultar logcat sanitizado' | tee "$OUT/result.txt"
  exit 1
fi
python3 - "$OUT" <<'PYTHON' 2>&1 | tee "$OUT/render-check.txt"
import json, sys
from pathlib import Path
import xml.etree.ElementTree as ET
out = Path(sys.argv[1])
expected = json.loads(Path('Frontend/ui-customer/package.json').read_text())['version']
diagnostic = json.loads((out / 'webview-state.json').read_text())
states = []
for context in diagnostic['contexts']:
    value = context.get('state', {}).get('result', {}).get('result', {}).get('value')
    if isinstance(value, str):
        states.append(json.loads(value))
if not any(s.get('version', {}).get('app') == expected and
           dict(s.get('globals', [])).get("onEvent'") == 'function' and
           s.get('josType') == 'object' for s in states if isinstance(s.get('version'), dict)):
    raise SystemExit('FALHA: frontend original nao inicializou callbacks e versao no contexto JOS')
root = ET.parse(out / 'window-120.xml').getroot()
nodes = list(root.iter('node'))
if any(n.get('resource-id', '').endswith(':id/splash') for n in nodes):
    raise SystemExit('FALHA: a splash nativa continua visivel apos 120 segundos')
if not any(n.get('package') == 'in.juspay.nammayatri.debug' and
           n.get('class') in ('android.widget.TextView', 'android.widget.EditText', 'android.widget.Button') and
           (n.get('text') or n.get('content-desc')) for n in nodes):
    raise SystemExit('FALHA: nenhum controle textual da interface original foi encontrado')
(out / 'development-mode.txt').write_text('true' if any(s.get('developmentMode') for s in states) else 'false')
print('Frontend original inicializado, splash encerrada e controles Android presentes.')
PYTHON
echo 'Abertura da interface original validada por 120 segundos. Capturas exigem inspecao visual; mapas e corridas nao foram validados.' | tee "$OUT/result.txt"

# BR test builds must enter the actual original home. A fallback to onboarding is a failure.
python3 Frontend/scripts/test-original-home.py "$OUT"

# Preserve cold-start/home evidence even if launcher navigation fails; still fail acceptance.
python3 - "$OUT" <<'PYBRAND'
import json, sys
from pathlib import Path
d = json.loads((Path(sys.argv[1]) / 'branding-launcher.json').read_text())
if not d['icon_found']:
    raise SystemExit('FALHA: icone nao localizado no launcher real; capturas preservadas')
print('Icone instalado encontrado no launcher; capturas de abertura e HomeScreen preservadas.')
PYBRAND
