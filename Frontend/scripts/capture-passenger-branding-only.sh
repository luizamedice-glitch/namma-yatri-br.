#!/usr/bin/env bash
# Visual follow-up for an APK whose Home/navigation checks already passed.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/android-original-evidence"
mkdir -p "$OUT"
mapfile -d '' APKS < <(find original-apk -name '*.apk' -print0)
[[ ${#APKS[@]} -eq 1 ]] || { echo 'Esperado exatamente um APK'; exit 1; }
sha256sum "${APKS[0]}" > "$OUT/apk.sha256"
adb install -g "${APKS[0]}"
python3 Frontend/scripts/capture-passenger-branding.py "$OUT"
python3 - "$OUT/branding-launcher.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
assert d['icon_found'] and d['launch_method'] == 'launcher_icon', 'Captura exige abertura pelo ícone real'
PY
adb shell pidof in.juspay.nammayatri.debug > "$OUT/process.txt"
