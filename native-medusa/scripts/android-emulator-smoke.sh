#!/usr/bin/env bash
# CI-only smoke test. Does not verify catalog, checkout or a running Medusa server.
set -euo pipefail

report="native-medusa/android/build/reports/shqipshop-emulator"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
test -s "$apk"
adb devices -l
abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
case "$abi" in
  x86_64*) ;;
  *) echo "::error::Expected x86_64 emulator, got $abi"; exit 1 ;;
esac
adb logcat -c
adb install -r "$apk"
adb shell am force-stop com.rnstartermedusa || true
adb shell am start -W -n com.rnstartermedusa/.MainActivity
sleep 15
# Preserve only error-level app crash markers, not unrestricted logs/PII.
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:E '*:S' > "$report/launch-errors.log" || true
adb exec-out screencap -p > "$report/emulator-launch.png"
if ! adb shell pidof com.rnstartermedusa | grep -Eq '[0-9]'; then
  echo "::error::Android app process not running 15 seconds after launch"
  sed -n '1,80p' "$report/launch-errors.log"
  exit 1
fi
if grep -Fq 'FATAL EXCEPTION' "$report/launch-errors.log"; then
  echo "::error::AndroidRuntime fatal exception"
  sed -n '1,80p' "$report/launch-errors.log"
  exit 1
fi
test -s "$report/emulator-launch.png"
printf 'SHQIPSHOP_ANDROID_EMULATOR_LAUNCH_PASSED ABI=%s\n' "$abi"
printf 'Backend intentionally disconnected: this only verifies install, process and launch.\n'
