#!/usr/bin/env bash
# Verify a complete synthetic Android order and its corrected receipt.
set -euo pipefail
report="native-medusa/android/build/reports/shqipshop-receipt"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
ui="native-medusa/scripts/shqipshop-ui-automation.py"
cleanup() {
  adb exec-out screencap -p > "$report/receipt.png" || true
  adb logcat -d -v brief AndroidRuntime:E '*:S' > "$report/android-crashes.log" || true
}
trap cleanup EXIT
test -s "$apk"
curl -fsS --max-time 10 http://127.0.0.1:9000/health > /dev/null
adb logcat -c
adb install -r "$apk"
adb shell am start -W -n com.rnstartermedusa/.MainActivity

python3 "$ui" wait "Medusa Shorts" --timeout 100
python3 "$ui" tap "Medusa Shorts" --timeout 40 --scroll 2
python3 "$ui" wait "Select Size" --timeout 60 --scroll 3
python3 "$ui" tap "S" --exact --timeout 50 --scroll 2
python3 "$ui" tap "Shto në shportë" --timeout 60 --scroll 3
python3 "$ui" wait "Shiko shportën" --timeout 90
python3 "$ui" tap "Shiko shportën" --timeout 50
python3 "$ui" tap "Përfundo porosinë" --timeout 65
python3 "$ui" fill "Email" --value "buyer-ci@example.invalid" --timeout 50 --scroll 2
python3 "$ui" fill "Emri" --value "Demo" --timeout 50 --scroll 2
python3 "$ui" fill "Mbiemri" --value "Buyer" --timeout 50 --scroll 2
python3 "$ui" fill "Adresa" --value "DemoStreet1" --timeout 50 --scroll 2
python3 "$ui" fill "Kodi postar" --value "1001" --timeout 50 --scroll 3
python3 "$ui" fill "Qyteti" --value "Tirana" --timeout 50 --scroll 3
python3 "$ui" fill "Telefoni" --value "0690000000" --timeout 50 --scroll 3
python3 "$ui" tap "Vazhdo te dorëzimi" --timeout 50
python3 "$ui" wait "Transport standard" --timeout 75
python3 "$ui" tap "Transport standard" --timeout 50
python3 "$ui" tap "Vazhdo te pagesa" --timeout 70
python3 "$ui" wait "Manual" --timeout 75
python3 "$ui" tap "Manual" --timeout 50
python3 "$ui" tap "Kontrollo porosinë" --timeout 70
python3 "$ui" wait "Dërgo porosinë" --timeout 75
python3 "$ui" tap "Dërgo porosinë" --timeout 60
python3 "$ui" wait "Detajet e porosisë" --timeout 100

# Values must be present in receipt UI; additionally verify row alignment,
# not merely that a product unit price appeared elsewhere on the page.
python3 native-medusa/scripts/assert-android-receipt-rows.py
python3 "$ui" wait "≈ €15,10" --timeout 65 --scroll 4
python3 native-medusa/scripts/assert-android-receipt-rows.py

if adb logcat -d -v brief AndroidRuntime:E '*:S' | grep -Fq 'FATAL EXCEPTION'; then
  echo "::error::Android fatal exception during receipt test"
  exit 1
fi
echo "SHQIPSHOP_ANDROID_RECEIPT_UI_PASSED" | tee "$report/status.txt"
echo "Synthetic Android UI order and receipt: 1500 ALL items + 10 ALL shipping = 1510 ALL." >> "$report/status.txt"
