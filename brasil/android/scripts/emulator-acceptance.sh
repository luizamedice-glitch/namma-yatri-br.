#!/usr/bin/env bash
# CI-only backend and APKs. This verifies account startup, not original-UI fidelity or Google routing.
set -euo pipefail
mkdir -p brasil/android/evidence
cleanup() {
  if [ -n "${gps_feed_pid:-}" ]; then kill "$gps_feed_pid" 2>/dev/null || true; fi
  adb shell dumpsys location > brasil/android/evidence/location-system.txt 2>/dev/null || true
  adb logcat -d 2>/dev/null | sed -E 's/(API Key:).*/\1 [redacted]/I' > brasil/android/evidence/logcat.txt || true
}
trap cleanup EXIT
gradle -p brasil/android :app:lintPassageiroDebug :app:lintMotoristaDebug :app:assemblePassageiroDebugAndroidTest :app:assembleMotoristaDebugAndroidTest --stacktrace
# Repeat the explicit test sensor fix after listeners register, with global location enabled.
# This is not evidence of physical-device GPS operation.
adb shell cmd location set-location-enabled true
(while true; do adb emu geo fix -46.6333 -23.5505 >> brasil/android/evidence/emulator-gps.txt; sleep 2; done) &
gps_feed_pid=$!
gradle -p brasil/android :app:connectedPassageiroDebugAndroidTest --stacktrace
adb emu geo fix -46.6333 -23.5505
gradle -p brasil/android :app:connectedMotoristaDebugAndroidTest --stacktrace
adb pull /sdcard/br-passenger-home.png brasil/android/evidence/passageiro-home.png
adb pull /sdcard/br-driver-home.png brasil/android/evidence/motorista-home.png
for profile in passageiro motorista; do
  adb install -r "brasil/android/app/build/outputs/apk/$profile/debug/app-$profile-debug.apk"
  # Installation by the test runner resets permissions. Grant again before screenshot capture.
  adb shell pm grant "br.com.namma.mobilidade.$profile" android.permission.ACCESS_COARSE_LOCATION
  adb shell pm grant "br.com.namma.mobilidade.$profile" android.permission.ACCESS_FINE_LOCATION
  adb emu geo fix -46.6333 -23.5505
  adb shell am start -W -n "br.com.namma.mobilidade.$profile/br.com.namma.mobilidade.MainActivity"
  found=false
  for attempt in {1..15}; do
    adb shell uiautomator dump /sdcard/window.xml > /dev/null
    adb pull /sdcard/window.xml "brasil/android/evidence/$profile-ui.xml" > /dev/null
    account=Fagner
    if [ "$profile" = motorista ]; then account=Giselo; fi
    if grep -Fq "text=\"$account\"" "brasil/android/evidence/$profile-ui.xml" && ! grep -Fq 'Conectando a conta' "brasil/android/evidence/$profile-ui.xml"; then found=true; break; fi
    sleep 1
  done
  [ "$found" = true ]
  adb shell dumpsys activity activities > "brasil/android/evidence/$profile-activities.txt"
  grep -Fq "package=\"br.com.namma.mobilidade.$profile\"" "brasil/android/evidence/$profile-ui.xml"
  adb shell screencap -p /sdcard/operacional.png
  adb pull /sdcard/operacional.png "brasil/android/evidence/$profile-operacional.png"
done
