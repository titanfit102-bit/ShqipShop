#!/usr/bin/env bash
# Disposable integration fixture: actual Android UI -> Medusa cart/order -> PostgreSQL.
# NEVER run against production or with non-synthetic consumer data.
set -euo pipefail
report="native-medusa/android/build/reports/shqipshop-checkout"
mkdir -p "$report"
apk="native-medusa/android/app/build/outputs/apk/release/app-release.apk"
ui="native-medusa/scripts/shqipshop-ui-automation.py"

stage=check-apk

capture() {
  local result=$1
  if (( result != 0 )); then
    printf '::error title=Android checkout failed::Stage %s exited with code %s.\n' "$stage" "$result"
    printf 'FAIL stage=%s exit_code=%s\n' "$stage" "$result" > "$report/status.txt" || true
  fi
  # Test-only screenshot; synthetic address/email. Do not capture unfiltered logs.
  adb exec-out screencap -p > "$report/checkout-final.png" || true
  adb logcat -d -v brief AndroidRuntime:E '*:S' > "$report/android-crashes.log" || true
}
trap 'capture "$?"' EXIT

ui_step() {
  stage=$1
  shift
  python3 "$ui" "$@"
}

test -s "$apk"
stage=backend-health
curl -fsS --max-time 10 http://127.0.0.1:9000/health > /dev/null
stage=reset-emulator-log
adb logcat -c
stage=install-apk
adb install -r "$apk"
stage=launch-storefront
adb shell am start -W -n com.rnstartermedusa/.MainActivity

# Add one product by pressing the React Native controls, not calling HTTP.
ui_step catalog-product-visible wait "Medusa Shorts" --timeout 100
ui_step open-product tap "Medusa Shorts" --timeout 40 --scroll 2
ui_step size-options-visible wait "Select Size" --timeout 60 --scroll 3
ui_step select-size tap "S" --exact --timeout 50 --scroll 2
ui_step add-to-cart tap "Shto në shportë" --timeout 60 --scroll 3
ui_step cart-action-visible wait "Shiko shportën" --timeout 90
ui_step open-cart tap "Shiko shportën" --timeout 50
ui_step cart-product-visible wait "Medusa Shorts" --timeout 70
ui_step eur-estimate-visible wait "≈ €15,00" --timeout 55 --scroll 2
ui_step open-checkout tap "Përfundo porosinë" --timeout 50

# All values below are made-up in a disposable DB.
# Filler reads actual Android accessibility labels: no screen-coordinate guessing.
ui_step enter-email fill "Email" --value "buyer-ci@example.invalid" --timeout 45 --scroll 2
ui_step enter-first-name fill "Emri" --value "Demo" --timeout 45 --scroll 2
ui_step enter-last-name fill "Mbiemri" --value "Buyer" --timeout 45 --scroll 2
ui_step enter-address fill "Adresa" --value "DemoStreet1" --timeout 45 --scroll 2
ui_step enter-postal-code fill "Kodi postar" --value "1001" --timeout 45 --scroll 3
ui_step enter-city fill "Qyteti" --value "Tirana" --timeout 45 --scroll 3
ui_step enter-phone fill "Telefoni" --value "0690000000" --timeout 45 --scroll 3
# Only supported country "al" auto-fills in React Native checkout UI.
ui_step open-delivery tap "Vazhdo te dorëzimi" --timeout 45
ui_step shipping-option-visible wait "Transport standard" --timeout 75
ui_step select-shipping tap "Transport standard" --timeout 50
ui_step open-payment tap "Vazhdo te pagesa" --timeout 70
ui_step manual-payment-visible wait "Manual" --timeout 80
ui_step select-manual-payment tap "Manual" --timeout 50
ui_step open-order-review tap "Kontrollo porosinë" --timeout 70
ui_step submit-action-visible wait "Dërgo porosinë" --timeout 75
ui_step review-product-visible wait "Medusa Shorts" --timeout 50 --scroll 3
# This tap is authorized only inside isolated CI using a non-chargeable manual provider.
ui_step submit-order tap "Dërgo porosinë" --timeout 60
ui_step receipt-visible wait "Detajet e porosisë" --timeout 100

stage=check-android-crashes
if grep -Fq 'FATAL EXCEPTION' <(adb logcat -d -v brief AndroidRuntime:E '*:S'); then
  echo "Android fatal exception during UI checkout"
  exit 1
fi
stage=write-success-report
echo "SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED" | tee "$report/status.txt"
echo "Android UI (not a Node HTTP test) completed checkout in ALL with a synthetic address and manual payment." >> "$report/status.txt"
