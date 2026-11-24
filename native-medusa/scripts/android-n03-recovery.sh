#!/usr/bin/env bash
set -euo pipefail

app=com.rnstartermedusa
apk=native-medusa/android/app/build/outputs/apk/debug/app-debug.apk
ui=native-medusa/scripts/shqipshop-ui-automation.py
fixture=native-medusa/scripts/n03-android-fixture.py
report=native-medusa/android/build/reports/shqipshop-n03
mkdir -p "$report"
test "${SHQIPSHOP_N03_ANDROID_CI:-}" = true
test -s "$apk"

start_app() {
  local result
  result=$(adb shell am start -W -n "$app/.MainActivity")
  if ! grep -Fq 'Status: ok' <<< "$result"; then
    printf '%s\n' "$result"
    return 1
  fi
}
open_cart() { python3 "$ui" tap "Shporta" --exact --timeout 120; }
check_order() { python3 "$ui" tap "Kontrollo statusin e porosisë" --exact --timeout 90; }
capture() { adb exec-out screencap -p > "$report/$1.png"; }

record_failure() {
  capture failed-stage || true
  adb shell dumpsys activity activities | grep -E 'topResumedActivity=|mResumedActivity:' || true
  adb logcat -d -v brief AndroidRuntime:E '*:S' | head -60 || true
}
trap record_failure ERR

curl -fsS --retry 5 --retry-connrefused http://127.0.0.1:9000/health >/dev/null
adb reverse tcp:9003 tcp:9003
adb logcat -c
adb install -r "$apk"
start_app
python3 "$ui" wait "Shporta" --exact --timeout 180

# Seed the real app storage, then let the actual UI submit the fully prepared cart.
python3 "$fixture" seed confirm
start_app
open_cart
python3 "$ui" tap "Përfundo porosinë" --exact --timeout 90
python3 "$ui" tap "Dërgo porosinë" --exact --timeout 75
python3 "$ui" wait "Statusi i porosisë ende nuk është konfirmuar" --timeout 75
python3 "$fixture" order
python3 "$fixture" storage lost
start_app
open_cart
check_order
python3 "$ui" wait "Detajet e porosisë" --exact --timeout 90
capture confirmed
python3 "$fixture" storage confirmed

# Independent owner-bound journals exercise both remaining server states.
python3 "$fixture" seed sealed
start_app
open_cart
check_order
python3 "$ui" wait "Porosia nuk u krijua" --timeout 90
capture sealed
python3 "$fixture" storage sealed

python3 "$fixture" seed unknown
start_app
open_cart
check_order
# Require a completed recovery read before checking retained storage.
python3 "$fixture" wait-unknown
python3 "$ui" wait "Kontrollo statusin e porosisë" --exact --timeout 45
python3 "$ui" wait "Statusi i porosisë ende nuk është konfirmuar" --timeout 75
capture unknown
python3 "$fixture" storage unknown
python3 "$fixture" order

if grep -Fq 'FATAL EXCEPTION' <(adb logcat -d -v brief AndroidRuntime:E '*:S'); then
  echo "::error::Android fatal exception during N03 recovery"
  exit 1
fi
echo "SHQIPSHOP_N03_ANDROID_NATIVE_RECOVERY_PASSED" | tee "$report/status.txt"
