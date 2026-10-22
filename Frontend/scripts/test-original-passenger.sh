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
adb shell am start -W -n in.juspay.nammayatri.debug/in.juspay.mobility.MainActivity > "$OUT/launch.txt"
# Captures distinguish a live splash from an interface that actually rendered.
ELAPSED=0
for stage in 10 50 110 120; do
  sleep "$((stage - ELAPSED))"
  ELAPSED=$stage
  adb exec-out screencap -p > "$OUT/screen-${stage}.png"
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$OUT/window-${stage}.xml" > /dev/null 2>&1 || true
  adb shell dumpsys activity activities > "$OUT/activity-${stage}.txt"
done
adb logcat -d > "$OUT/logcat.private"
python3 - "$OUT" <<'PY'
from pathlib import Path
import re, sys
out = Path(sys.argv[1])
raw = out / 'logcat.private'
text = raw.read_text(errors='replace')
text = re.sub(r'AIza[0-9A-Za-z_-]{20,}', '[REDACTED_GOOGLE_KEY]', text)
text = re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+', r'\1[REDACTED]', text)
(out / 'logcat.txt').write_text(text)
raw.unlink()
PY
if ! adb shell pidof in.juspay.nammayatri.debug > "$OUT/process.txt"; then
  echo 'FALHA: processo do passageiro encerrou durante o teste' | tee "$OUT/result.txt"
  exit 1
fi
if grep -q 'FATAL EXCEPTION' "$OUT/logcat.txt"; then
  echo 'FALHA: excecao fatal registrada; consultar logcat sanitizado' | tee "$OUT/result.txt"
  exit 1
fi
echo 'Processo permaneceu ativo por 120 segundos. Capturas exigem inspecao visual; este teste nao comprova tela operacional nem corridas.' | tee "$OUT/result.txt"
