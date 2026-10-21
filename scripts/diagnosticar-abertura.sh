#!/usr/bin/env bash
set -Eeuo pipefail
echo "==> Procurando APK debug de passageiro"
find Frontend/android-native/app/build/outputs/apk -type f -name '*.apk' -print
APK="$(find Frontend/android-native/app/build/outputs/apk -type f -name '*debug*.apk' -print -quit)"
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "::error::APK não encontrado no diretório de saída."
  exit 1
fi
echo "==> Instalando $(basename "$APK")"
adb install -r "$APK"
echo "==> Iniciando aplicativo para diagnóstico"
adb logcat -c
adb shell am start -W -n in.juspay.nammayatri.debug/in.juspay.mobility.MainActivity > launch.txt 2>&1 || true
sleep 20
adb logcat -d -v time > android-logcat.txt
adb shell dumpsys activity activities > activities.txt
adb exec-out screencap -p > tela-inicial.png || true
adb shell dumpsys window windows > janela-ativa.txt || true
grep -n -A 28 -B 8 -E 'FATAL EXCEPTION|AndroidRuntime|Unable to start activity|ClassNotFoundException|FirebaseApp|FATAL SIGNAL' android-logcat.txt > falhas-resumo.txt || true
cat launch.txt
head -150 falhas-resumo.txt || true
if grep -q 'FATAL EXCEPTION' android-logcat.txt; then
  echo "::error::O aplicativo apresentou uma exceção fatal; veja falhas-resumo.txt."
  exit 1
fi
echo "==> Sem exceção fatal no período de observação. Captura tela-inicial.png disponível."
