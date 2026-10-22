#!/usr/bin/env bash
# Tests the REAL React Native product list against a disposable Medusa backend.
# This only proves catalog reading on-device; NOT mobile checkout.
set -euo pipefail
report="native-medusa/android/build/reports/shqipshop-connected"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
test -s "$apk"
curl -fsS --max-time 10 http://127.0.0.1:9000/health >/dev/null
adb shell getprop sys.boot_completed
adb logcat -c
adb install -r "$apk"
adb shell am start -W -n com.rnstartermedusa/.MainActivity
# React Native text elements are in Android's accessibility hierarchy.
# Repeatedly dump hierarchy while asynchronous region/product queries complete.
match=0
for i in $(seq 1 30); do
  sleep 4
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || true
  adb exec-out cat /sdcard/window.xml > "$report/ui-local.xml" || true
  if grep -Eq 'Medusa T-Shirt|Medusa Sweatshirt|Medusa Shorts|Medusa Sweatpants' "$report/ui-local.xml"; then
    match=1
    break
  fi
  if ! adb shell pidof com.rnstartermedusa | grep -Eq '[0-9]'; then
    echo "::error::Native app process terminated before loading Medusa products"
    break
  fi
done
adb exec-out screencap -p > "$report/android-catalog.png"
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:E '*:S' > "$report/crash-filtered.log" || true
# Do not upload Android XML tree, which might embed unexpected app content.
rm -f "$report/ui-local.xml"
if grep -Fq 'FATAL EXCEPTION' "$report/crash-filtered.log"; then
  echo "::error::Native Android crash"
  sed -n '1,70p' "$report/crash-filtered.log"
  exit 1
fi
if [ "$match" -ne 1 ]; then
  echo "::error::App did not expose any seeded Medusa product title in Android UI"
  sed -n '1,70p' "$report/crash-filtered.log"
  exit 1
fi
test -s "$report/android-catalog.png"
printf 'SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED\n' | tee "$report/result.txt"
printf 'Source: Medusa PostgreSQL + Store API on host, called by actual Android app. No checkout performed.\n' >> "$report/result.txt"
