#!/usr/bin/env bash
# Real product detail -> option -> add-to-cart -> cart UI, against ephemeral Medusa.
# This is not an order/checkout test and does not interact with real customers.
set -euo pipefail
report="native-medusa/android/build/reports/shqipshop-ui-cart"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
ui="native-medusa/scripts/shqipshop-ui-automation.py"

cleanup() {
  # Always capture local test-only screenshot and filter fatal Android errors.
  adb exec-out screencap -p > "$report/final-ui.png" || true
  adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:E '*:S' > "$report/crash-filtered.log" || true
}
trap cleanup EXIT

test -s "$apk"
curl -fsS --max-time 10 http://127.0.0.1:9000/health >/dev/null
adb logcat -c
adb install -r "$apk"
adb shell am start -W -n com.rnstartermedusa/.MainActivity

python3 "$ui" wait "Medusa Shorts" --timeout 95
python3 "$ui" tap "Medusa Shorts" --timeout 35 --scroll 2
# Variant picker is part of the original React Native UI, not a direct API call.
python3 "$ui" wait "Select Size" --timeout 55 --scroll 3
python3 "$ui" tap "S" --exact --timeout 45 --scroll 2
python3 "$ui" tap "Shto në shportë" --timeout 45 --scroll 3
python3 "$ui" wait "Shiko shportën" --timeout 90
python3 "$ui" tap "Shiko shportën" --timeout 40
python3 "$ui" wait "Përfundo porosinë" --timeout 60
python3 "$ui" wait "Medusa Shorts" --timeout 45

test -z "$(adb logcat -d -v brief AndroidRuntime:E '*:S' | grep 'FATAL EXCEPTION' || true)"
echo "SHQIPSHOP_ANDROID_UI_CART_PASSED" | tee "$report/status.txt"
echo "Proved native product detail, variant selection, add-to-cart and cart UI; no checkout yet." >> "$report/status.txt"
