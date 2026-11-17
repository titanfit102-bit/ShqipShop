#!/usr/bin/env python3
"""CI-only Redis proof: Medusa must actually write events to EACH merchant's Redis.

No auth tokens, cart IDs, values, or raw Redis key names are printed. Neither
PING nor a Redis URL in the environment is accepted as runtime integration.
This script only checks the two disposable, independently provisioned CI Redis
servers after synthetic Medusa order and auth operations have completed.
"""
import socket
import sys

HOST = "127.0.0.1"
PORTS = (6379, 6381)


def _read_resp(stream):
    lead = stream.read(1)
    if not lead:
        raise RuntimeError("Redis connection closed")
    line = stream.readline().rstrip(b"\r\n")
    if lead == b"+":
        return line.decode("utf-8")
    if lead == b":":
        return int(line)
    if lead == b"-":
        raise RuntimeError("Redis error: " + line.decode("utf-8"))
    if lead == b"$":
        length = int(line)
        if length < 0:
            return None
        data = stream.read(length)
        assert stream.read(2) == b"\r\n"
        return data
    if lead == b"*":
        count = int(line)
        return [_read_resp(stream) for _ in range(count)]
    raise RuntimeError("Unexpected Redis RESP prefix")


def request(port, *command):
    with socket.create_connection((HOST, port), timeout=8) as sock:
        sock.settimeout(8)
        stream = sock.makefile("rb")
        payload = b"*" + str(len(command)).encode() + b"\r\n"
        for part in command:
            part = str(part).encode()
            payload += b"$" + str(len(part)).encode() + b"\r\n" + part + b"\r\n"
        sock.sendall(payload)
        return _read_resp(stream)


def get_keys(port):
    all_keys = set()
    cursor = b"0"
    for _ in range(1000):
        response = request(port, "SCAN", cursor.decode(), "COUNT", "250")
        cursor, found = response
        all_keys.update(key.decode("utf-8", errors="replace") for key in found)
        if cursor == b"0":
            return all_keys
    raise AssertionError("Unexpected Redis SCAN cursor loop")


def main():
    stats = []
    for port in PORTS:
        assert request(port, "PING") == "PONG", "Redis unavailable"
        keys = get_keys(port)
        # Medusa Redis Event Module (BullMQ) creates an events-queue namespace
        # as synthetic checkout/order events are emitted. A raw PONG alone
        # would leave this count zero.
        events = [key for key in keys if "events-queue" in key]
        workflows = [key for key in keys if "medusa-workflows" in key]
        assert len(events) > 0, (
            f"Medusa events were not stored in Redis on port {port}. "
            "Do not mistake Redis PING for provider integration."
        )
        stats.append((len(keys), len(events), len(workflows)))

    # Both stores emitted events into their own physical Redis endpoints. An
    # injected, shared URL would leave at least one instance with zero events.
    print("SHQIPSHOP_REDIS_A_B_EVENT_BUS_RUNTIME_PASSED")
    for label, (all_count, event_count, workflow_count) in zip(("A", "B"), stats):
        print(
            f"SHQIPSHOP_REDIS_{label}_KEY_COUNTS "
            f"total={all_count} events={event_count} workflows={workflow_count}"
        )
    print("LIMIT: key presence proves Redis-backed event activity, not "
          "worker restart persistence, session isolation, caching or HA")


if __name__ == "__main__":
    if len(sys.argv) != 1:
        raise SystemExit("Use only in synthetic CI with dedicated Redis on ports 6379 and 6381")
    main()
