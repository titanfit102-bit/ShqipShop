#!/usr/bin/env bash
# Disposable integration fixture: actual Android UI -> Medusa cart/order -> PostgreSQL.
# NEVER run against production or with non-synthetic consumer data.
set -euo pipefail
report="native-medusa/android/build/reports/shqipshop-checkout"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
ui="native-medusa/scripts/shqipshop-ui-automation.py"

capture() {
  # Test-only screenshot; synthetic address/email. Do not capture unfiltered logs.
  adb exec-out screencap -p > "$report/checkout-final.png" || true
  adb logcat -d -v brief AndroidRuntime:E '*:S' > "$report/android-crashes.log" || true
}
trap capture EXIT

test -s "$apk"
curl -fsS --max-time 10 http://127.0.0.1:9000/health > /dev/null
adb logcat -c
adb install -r "$apk"
adb shell am start -W -n com.rnstartermedusa/.MainActivity

# Add one product by pressing the React Native controls, not calling HTTP.
python3 "$ui" wait "Medusa Shorts" --timeout 100
python3 "$ui" tap "Medusa Shorts" --timeout 40 --scroll 2
python3 "$ui" wait "Select Size" --timeout 60 --scroll 3
python3 "$ui" tap "S" --exact --timeout 50 --scroll 2
python3 "$ui" tap "Shto në shportë" --timeout 60 --scroll 3
python3 "$ui" wait "Shiko shportën" --timeout 90
python3 "$ui" tap "Shiko shportën" --timeout 50
python3 "$ui" wait "Medusa Shorts" --timeout 70
python3 "$ui" wait "≈ €15,00" --timeout 55 --scroll 2
python3 "$ui" tap "Përfundo porosinë" --timeout 50

# All values below are made-up in a disposable DB.
# Filler reads actual Android accessibility labels: no screen-coordinate guessing.
python3 "$ui" fill "Email" --value "buyer-ci@example.invalid" --timeout 45 --scroll 2
python3 "$ui" fill "Emri" --value "Demo" --timeout 45 --scroll 2
python3 "$ui" fill "Mbiemri" --value "Buyer" --timeout 45 --scroll 2
python3 "$ui" fill "Adresa" --value "DemoStreet1" --timeout 45 --scroll 2
python3 "$ui" fill "Kodi postar" --value "1001" --timeout 45 --scroll 3
python3 "$ui" fill "Qyteti" --value "Tirana" --timeout 45 --scroll 3
python3 "$ui" fill "Telefoni" --value "0690000000" --timeout 45 --scroll 3
# Only supported country "al" auto-fills in React Native checkout UI.
python3 "$ui" tap "Vazhdo te dorëzimi" --timeout 45
python3 "$ui" wait "Transport standard" --timeout 75
python3 "$ui" tap "Transport standard" --timeout 50
python3 "$ui" tap "Vazhdo te pagesa" --timeout 70
python3 "$ui" wait "Manual" --timeout 80
python3 "$ui" tap "Manual" --timeout 50
python3 "$ui" tap "Kontrollo porosinë" --timeout 70
python3 "$ui" wait "Dërgo porosinë" --timeout 75
python3 "$ui" wait "Medusa Shorts" --timeout 50 --scroll 3
# This tap is authorized only inside isolated CI using a non-chargeable manual provider.
python3 "$ui" tap "Dërgo porosinë" --timeout 60
python3 "$ui" wait "Detajet e porosisë" --timeout 100

if grep -Fq 'FATAL EXCEPTION' <(adb logcat -d -v brief AndroidRuntime:E '*:S'); then
  echo "::error::Android fatal exception during UI checkout"
  exit 1
fi
echo "SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED" | tee "$report/status.txt"
echo "Android UI (not a Node HTTP test) completed checkout in ALL with a synthetic address and manual payment." >> "$report/status.txt"
