#!/usr/bin/env python3
"""Prepare and check synthetic N03 carts and relay only to disposable local Medusa."""
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(os.environ["RUNNER_TEMP"])
STATE = ROOT / "n03-android-private.json"
DROPPED = ROOT / "n03-android-dropped"
SUBMISSION = ROOT / "n03-android-submission"
UNKNOWN_READ = ROOT / "n03-android-unknown-read"
BACKEND = "http://127.0.0.1:9003"
RECOVERY = "/store/shqipshop/order-recovery-ci"
QUOTE_REVIEW = "/store/shqipshop/quote-review-accept-ci"
MEDUSA_WORKSPACE = Path(__file__).resolve().parents[2] / "medusa-backend-poc"
APP = "com.rnstartermedusa"
DATABASE = "databases/AsyncStorage"
PENDING = "shqipshop:order-completion-pending"


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def load():
    return json.loads(STATE.read_text())


def medusa(method, path, key=None, token=None, body=None, expected=200, extra_headers=None):
    headers = {"Accept": "application/json", **(extra_headers or {})}
    if key:
        headers["x-publishable-api-key"] = key
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"
    connection = http.client.HTTPConnection("127.0.0.1", 9000, timeout=20)
    try:
        connection.request(method, path, json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        payload = response.read()
        statuses = (expected,) if isinstance(expected, int) else expected
        require(response.status in statuses, f"Fixture HTTP {method} {path.split('?')[0]}: {response.status}")
        return json.loads(payload)
    finally:
        connection.close()


def setup():
    key = (ROOT / "n03-android-key.txt").read_text().strip()
    email = "n03-android-buyer@example.invalid"
    password = os.urandom(24).hex()
    credentials = {"email": email, "password": password}
    registration = medusa("POST", "/auth/customer/emailpass/register", body=credentials, expected=(200, 201))
    customer = medusa("POST", "/store/customers", key, registration["token"], {
        "email": email, "first_name": "Synthetic", "last_name": "Buyer",
    }, expected=(200, 201))["customer"]["id"]
    token = medusa("POST", "/auth/customer/emailpass", body=credentials)["token"]

    def api(method, path, body=None, expected=200):
        return medusa(method, path, key, token, body, expected)

    region = next(r["id"] for r in api("GET", "/store/regions")["regions"] if r["name"] == "Shqipëri")
    products = {p["title"]: p for p in api("GET", f"/store/products?region_id={region}&fields=%2Bvariants.*")["products"]}
    product = products["Medusa Shorts"]
    variant = product["variants"][0]["id"]
    unchanged_variant = products["Medusa T-Shirt"]["variants"][0]["id"]
    cart = api("POST", RECOVERY, {"region_id": region}, expected=201)["cart_id"]
    sealed = api("POST", RECOVERY, {"region_id": region}, expected=201)["cart_id"]
    unknown = api("POST", RECOVERY, {"region_id": region}, expected=201)["cart_id"]
    require(api("POST", RECOVERY + "/cancel", {"cart_id": sealed}) == {"state": "no_order"}, "Seal failed")

    address = {
        "first_name": "Synthetic", "last_name": "Buyer", "address_1": "CI street",
        "city": "Tirana", "postal_code": "1001", "country_code": "al", "phone": "0690000000",
    }
    for item_variant in (variant, unchanged_variant):
        api("POST", f"/store/carts/{cart}/line-items", {"variant_id": item_variant, "quantity": 1})
    api("POST", f"/store/carts/{cart}", {"email": email, "shipping_address": address, "billing_address": address})
    shipping = api("GET", f"/store/shipping-options?cart_id={cart}")["shipping_options"][0]["id"]
    api("POST", f"/store/carts/{cart}/shipping-methods", {"option_id": shipping})
    collection = api("POST", "/store/payment-collections", {"cart_id": cart})["payment_collection"]["id"]
    api("POST", f"/store/payment-collections/{collection}/payment-sessions",
        {"provider_id": "pp_system_default"}, expected=(200, 201))
    for value in (cart, sealed, unknown):
        require(re.fullmatch(r"cart_[A-Za-z0-9_-]{8,}", value), "Invalid fixture cart")
    subprocess.run(
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
         "-U", "shqipshop_ci_a", "-d", "shqipshop_ci_a", "-v", f"cart={cart}"],
        input="UPDATE shqipshop_n03_disposable_attempt SET quote_required = true WHERE cart_id = :'cart';",
        text=True, check=True, timeout=15, env={**os.environ, "PGPASSWORD": "merchantA_disposable"},
    )
    with os.fdopen(os.open(STATE, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "w") as stream:
        json.dump(dict(key=key, token=token, customer=customer, region=region,
                       confirm=cart, sealed=sealed, unknown=unknown,
                       product=product["id"], variant=variant, unchanged_variant=unchanged_variant), stream)
    print("SHQIPSHOP_N03_ANDROID_TRACKED_CARTS_READY")


def medusa_script(name, *args, env=None):
    subprocess.run(
        ["pnpm", "--filter", "@dtc/backend", "exec", "medusa", "exec", f"./src/scripts/{name}", *args],
        cwd=MEDUSA_WORKSPACE, check=True, timeout=120,
        env={**os.environ, "JWT_SECRET": os.urandom(32).hex(),
             "COOKIE_SECRET": os.urandom(32).hex(), **(env or {})},
    )


def line_amounts(commerce):
    amounts = {line["variant_id"]: {"quantity": line["quantity"], "unit_price": line["unit_price"]}
               for line in commerce["items"]}
    require(len(amounts) == len(commerce["items"]), "Fixture variants must be distinct")
    return amounts


def reprice():
    fixture = load()
    cart_id = fixture["confirm"]
    cart_path = "/store/carts/" + cart_id
    key, token = fixture["key"], fixture["token"]
    before = medusa("GET", cart_path, key, token)["cart"]
    amounts = line_amounts(before)
    require(before["currency_code"] == "all" and
            set(amounts) == {fixture["variant"], fixture["unchanged_variant"]} and
            all(line["quantity"] == 1 for line in amounts.values()), "Expected two distinct ALL fixture lines")

    # Pre-accept a separate copy of the old offer to exercise the direct
    # completion guard while Android still holds its own unaccepted offer.
    binding = {"x-shqipshop-cart-id": cart_id}
    old = medusa("POST", QUOTE_REVIEW, key, token, {"review": True}, extra_headers=binding)
    require(old["currency"] == "all" and old["total"] == str(before["total"]), "Old offer total mismatch")
    accepted = medusa("POST", QUOTE_REVIEW, key, token,
                      {"quote_id": old["quote_id"], "fingerprint": old["fingerprint"]},
                      extra_headers=binding)
    require(accepted == {"accepted": True, "quote_id": old["quote_id"]}, "Old baseline acceptance failed")

    proof = ROOT / "n03-android-catalogue-input.json"
    original = amounts[fixture["variant"]]["unit_price"]
    require(type(original) is int and type(before["total"]) is int, "Fixture amounts must be whole ALL")
    proof.write_text(json.dumps({"productId": fixture["product"], "variantId": fixture["variant"],
                                "originalAmount": original, "expectedAmount": original + 17}))
    medusa_script("f07e-store-reprice-ci.ts", env={
        "SHQIPSHOP_F07E_REPRICE_PROBE": "true", "SHQIPSHOP_F07E_REPRICE_PROOF_FILE": str(proof),
    })
    after = medusa("GET", cart_path, key, token)["cart"]
    require(after["total"] == before["total"] and after["shipping_total"] == before["shipping_total"] and
            line_amounts(after) == amounts,
            "Catalogue change must leave the cart stale")
    print("SHQIPSHOP_F07G_N03_CATALOGUE_CHANGED_CART_REMAINED_STALE")

    rejected = medusa("POST", cart_path + "/complete", key, token, expected=412, extra_headers={
        "x-shqipshop-quote-id": old["quote_id"], "x-shqipshop-quote-fingerprint": old["fingerprint"],
    })
    require(rejected == {"message": "F07G_QUOTE_REVIEW_REQUIRED"} and
            medusa("GET", f"{RECOVERY}?cart_id={cart_id}", key, token) == {"state": "unknown"} and
            medusa("GET", "/store/orders", key, token)["count"] == 0,
            "Old accepted quote must be refused before order creation")
    print("SHQIPSHOP_F07G_N03_CATALOGUE_STALE_ACCEPTED_QUOTE_BLOCKED")

    amounts[fixture["variant"]]["unit_price"] = original + 17
    total = int(before["total"]) + 17
    (ROOT / "n03-android-expected-lines.json").write_text(json.dumps({
        "items": amounts, "shipping": before["shipping_total"], "total": total,
    }))
    (ROOT / "n03-android-repriced-total").write_text(str(total))
    require(not SUBMISSION.exists(), "Quote review dispatched checkout before acceptance")


def verify_amounts(commerce):
    expected = json.loads((ROOT / "n03-android-expected-lines.json").read_text())
    require(commerce["currency_code"] == "all" and commerce["total"] == expected["total"] and
            commerce["shipping_total"] == expected["shipping"] and line_amounts(commerce) == expected["items"],
            "ALL total, both distinct line prices and unchanged shipping must match the accepted offer")


def verify_refreshed_cart():
    fixture = load()
    key, token = fixture["key"], fixture["token"]
    require(not SUBMISSION.exists() and medusa("GET", "/store/orders", key, token)["count"] == 0,
            "Refreshed cart must still await explicit consent")
    cart = medusa("GET", f'/store/carts/{fixture["confirm"]}', key, token)["cart"]
    verify_amounts(cart)
    print("SHQIPSHOP_F07G_N03_TWO_LINES_AND_UNCHANGED_SHIPPING_VERIFIED")


def proxy():
    fixture = load()
    completion_path = f'/store/carts/{fixture["confirm"]}/complete'
    unknown_path = f'{RECOVERY}?cart_id={fixture["unknown"]}'

    forwarded = {"accept", "authorization", "content-type", "x-publishable-api-key",
                 "x-shqipshop-cart-id", "x-shqipshop-quote-id", "x-shqipshop-quote-fingerprint"}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def relay(self):
            if not self.path.startswith(("/store/", "/auth/")) or self.path.startswith("//"):
                self.send_error(404)
                return
            headers = {k: v for k, v in self.headers.items() if k.lower() in forwarded}
            size = int(self.headers.get("Content-Length", 0))
            if size < 0 or size > 1_000_000:
                self.send_error(413)
                return
            data = self.rfile.read(size) if size else None
            connection = http.client.HTTPConnection("127.0.0.1", 9000, timeout=25)
            try:
                completes_order = self.command == "POST" and self.path.split("?")[0] == completion_path
                if completes_order:
                    try:
                        SUBMISSION.touch(exist_ok=False)
                    except FileExistsError:
                        (ROOT / "n03-android-replay").touch()
                        self.send_error(409)
                        return
                connection.request(self.command, self.path, data, headers)
                response = connection.getresponse()
                payload = response.read()
                if completes_order and response.status == 200:
                    order = json.loads(payload)
                    if order.get("type") == "order":
                        with DROPPED.open("x") as stream:
                            stream.write(order["order"]["id"])
                        (ROOT / "n03-android-dispatched-order").write_text(json.dumps({
                            "currency": order["order"]["currency_code"], "total": order["order"]["total"],
                        }))
                        # Medusa already committed. Do not acknowledge the POST to Android.
                        self.connection.shutdown(socket.SHUT_RDWR)
                        self.close_connection = True
                        return
                self.send_response(response.status)
                self.send_header("Content-Type", response.getheader("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                if self.command == "GET" and self.path == unknown_path and response.status == 200:
                    if json.loads(payload) == {"state": "unknown"}:
                        UNKNOWN_READ.touch()
            finally:
                connection.close()

        do_GET = do_POST = do_DELETE = relay

    ThreadingHTTPServer(("127.0.0.1", 9003), Handler).serve_forever()


def adb(*args, data=None, check=True):
    return subprocess.run(["adb", *args], input=data, capture_output=True, check=check, timeout=30)


def storage(case=None):
    """Use the initialized Android app's own Room schema and actual persisted storage."""
    fixture = load()
    adb("shell", "am", "force-stop", APP)
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        copy = Path(directory) / "AsyncStorage"
        for suffix in ("", "-wal"):
            result = adb("exec-out", "run-as", APP, "cat", DATABASE + suffix, check=not suffix)
            if result.returncode == 0 and result.stdout:
                Path(str(copy) + suffix).write_bytes(result.stdout)
        require(copy.is_file(), "Native AsyncStorage database was not initialized")
        with sqlite3.connect(copy) as db:
            if case:
                cart = fixture[case]
                db.execute('DELETE FROM Storage WHERE key IN (?, ?)', (PENDING, "shqipshop:cart-reset-pending"))
                values = {"auth_token":fixture["token"], "cart_id":cart, "region_id":fixture["region"], "locale":"sq-AL"}
                if case != "confirm":
                    values[PENDING] = json.dumps({"cartId":cart, "backend":BACKEND, "customerId":fixture["customer"]},
                                                 separators=(",", ":"))
                db.executemany("INSERT OR REPLACE INTO Storage(key, value) VALUES (?, ?)", values.items())
            recorded = db.execute("SELECT value FROM Storage WHERE key = ?", (PENDING,)).fetchone()
        if case:
            # Fold the WAL into the database before copying it back to the stopped app.
            with sqlite3.connect(copy) as db:
                db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            adb("shell", f"run-as {APP} rm -f {DATABASE}-wal {DATABASE}-shm")
            adb("shell", "-T", f"run-as {APP} sh -c 'cat > {DATABASE}'", data=copy.read_bytes())
    return json.loads(recorded[0]) if recorded else None


def verify_storage(kind):
    expected = load()
    marker = storage()
    if kind in ("sealed", "confirmed"):
        require(marker is None, "Terminal native recovery left a pending journal")
    else:
        name = "unknown" if kind == "unknown" else "confirm"
        require(marker == {"cartId":expected[name], "backend":BACKEND, "customerId":expected["customer"]},
                "Original native scoped journal was not retained")
    print(f"SHQIPSHOP_N03_ANDROID_STORAGE_{kind.upper()}_VERIFIED")


def verify_order():
    fixture = load()
    require(DROPPED.is_file(), "No committed completion response was dropped")
    require(not (ROOT / "n03-android-replay").exists(), "Android replayed completion")
    order = DROPPED.read_text()
    require(re.fullmatch(r"order_[A-Za-z0-9_-]{8,}", order), "Unexpected persisted order ID")
    key, token = fixture["key"], fixture["token"]
    result = medusa("GET", f'{RECOVERY}?cart_id={fixture["confirm"]}', key, token)
    require(result == {"state":"confirmed", "order_id":order}, "Recovery did not match the committed order")
    orders = medusa("GET", "/store/orders", key, token)
    require(orders["count"] == 1 and [item["id"] for item in orders["orders"]] == [order],
            "Fixture account must have exactly one order")
    receipt = medusa("GET", f"/store/orders/{order}", key, token)["order"]
    expected_total = (ROOT / "n03-android-repriced-total").read_text()
    dispatched = json.loads((ROOT / "n03-android-dispatched-order").read_text())
    require(dispatched["currency"] == "all" and str(dispatched["total"]) == expected_total,
            "Completed order must match the refreshed ALL quote")
    verify_amounts(receipt)
    print("SHQIPSHOP_N03_ANDROID_ONE_COMMITTED_ORDER_VERIFIED")


def verify_payment():
    fixture = load()
    (ROOT / "n03-android-ledger-input.json").write_text(json.dumps({
        "cartId": fixture["confirm"], "customerId": fixture["customer"], "orderId": DROPPED.read_text(),
        "total": int((ROOT / "n03-android-repriced-total").read_text()),
    }))
    medusa_script("f08-payment-ledger-ci.ts", "n03-catalogue")


def main():
    require(os.environ.get("CI") == "true" and os.environ.get("SHQIPSHOP_N03_ANDROID_CI") == "true",
            "Only run against the disposable CI fixture")
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("setup", "proxy", "seed", "storage", "order", "wait-unknown", "reprice", "refreshed", "payment"))
    parser.add_argument("case", nargs="?", choices=("confirm", "confirmed", "sealed", "unknown", "lost"))
    args = parser.parse_args()
    if args.action == "setup":
        setup()
    elif args.action == "refreshed":
        verify_refreshed_cart()
    elif args.action == "payment":
        verify_payment()
    elif args.action == "proxy":
        proxy()
    elif args.action == "seed":
        require(args.case in ("confirm", "sealed", "unknown"), "Invalid Android seed case")
        storage(args.case)
    elif args.action == "storage":
        require(args.case in ("confirmed", "sealed", "unknown", "lost"), "Invalid Android storage case")
        verify_storage(args.case)
    elif args.action == "order":
        verify_order()
    elif args.action == "reprice":
        reprice()
    else:
        limit = time.monotonic() + 35
        while not UNKNOWN_READ.exists() and time.monotonic() < limit:
            time.sleep(0.2)
        require(UNKNOWN_READ.exists(), "Native client did not read the unknown outcome")


if __name__ == "__main__":
    main()
