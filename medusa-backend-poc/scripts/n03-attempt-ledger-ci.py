"""Exercise a checkout dispatch fence in disposable PostgreSQL, without an API."""
import os
import select
import subprocess
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

TABLE = "shqipshop_n03_disposable_attempt"
# The fixture models a dispatcher that can act only after a committed claim.
# Sealing and claiming compete for the same prepared row. A claim alone
# cannot confirm an order or justify releasing the attempt for replay.
CLAIM = f"""
WITH changed AS (
  UPDATE {TABLE} SET phase = 'claimed_for_dispatch'
  WHERE attempt_id = :'attempt' AND cart_id = :'cart' AND phase = 'prepared'
  RETURNING 1
)
SELECT count(*) FROM changed;
"""
SEAL = f"""
WITH changed AS (
  UPDATE {TABLE} SET phase = 'sealed_before_dispatch'
  WHERE attempt_id = :'attempt' AND cart_id = :'cart' AND phase = 'prepared'
  RETURNING 1
)
SELECT count(*) FROM changed;
"""
READ = f"""
SELECT CASE phase WHEN 'sealed_before_dispatch' THEN 'no_order' ELSE 'unknown' END
FROM {TABLE} WHERE attempt_id = :'attempt' AND cart_id = :'cart';
"""


def connection(merchant, attempt=None, cart=None):
    database = f"shqipshop_ci_{merchant.lower()}"
    command = [
        "psql", "-X", "-qAt", "-w", "-h", "127.0.0.1", "-p", "5432",
        "-U", database, "-d", database, "-v", "ON_ERROR_STOP=1",
        "-v", f"attempt={attempt}", "-v", f"cart={cart}",
    ]
    env = {
        "PATH": os.environ["PATH"],
        "PGPASSWORD": f"merchant{merchant}_disposable",
        "PGCONNECT_TIMEOUT": "4",
        "PGOPTIONS": "-c statement_timeout=8000 -c lock_timeout=6000",
        "LC_ALL": "C",
    }
    return command, env


def sql(merchant, statement, attempt=None, cart=None):
    command, env = connection(merchant, attempt, cart)
    result = subprocess.run(
        command, env=env, input=statement, text=True, capture_output=True,
        timeout=12, check=True,
    )
    return result.stdout.strip()


def prepare(merchant, attempt, cart):
    sql(merchant, f"""
        INSERT INTO {TABLE} (attempt_id, cart_id) VALUES (:'attempt', :'cart');
    """, attempt, cart)


def outcome(merchant, attempt, cart):
    return sql(merchant, READ, attempt, cart) or "unknown"


def fixture():
    return str(uuid4()), f"cart_n03_{uuid4().hex}"


def line(process):
    ready, _, _ = select.select([process.stdout], [], [], 12)
    assert ready, "Timed out waiting on the isolated PostgreSQL session"
    return process.stdout.readline().decode().strip()


def lose_session(merchant, attempt, cart, *, committed):
    """Destroy the connection holding the dispatch claim before it can do any work."""
    command, env = connection(merchant, attempt, cart)
    with subprocess.Popen(
        command, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, bufsize=0,
    ) as process:
        try:
            commit = "COMMIT;" if committed else ""
            process.stdin.write(f"BEGIN;\n{CLAIM}\n{commit}\nSELECT pg_backend_pid();\n".encode())
            assert line(process) == "1"
            pid = int(line(process))
            assert pid > 0
            assert outcome(merchant, attempt, cart) == "unknown"
            assert sql(merchant, f"SELECT pg_terminate_backend({pid}, 5000);") == "t"
            # Idle psql may still be waiting for input after its backend exits.
            try:
                process.stdin.write(b"SELECT 1;\n")
            except BrokenPipeError:
                pass
            process.stdin.close()
            assert process.wait(timeout=12) != 0
        finally:
            if process.poll() is None:
                process.kill()


def main():
    assert os.environ.get("CI") == "true"
    assert os.environ.get("SHQIPSHOP_N03_ATTEMPT_LEDGER_CI") == "true"
    for merchant in ("A", "B"):
        db = f"shqipshop_ci_{merchant.lower()}"
        assert sql(merchant, "SELECT current_database() || ':' || current_user;") == f"{db}:{db}"
        sql(merchant, f"""
          CREATE TABLE {TABLE} (
            attempt_id uuid PRIMARY KEY,
            cart_id text UNIQUE NOT NULL,
            phase text NOT NULL DEFAULT 'prepared'
              CHECK (phase IN ('prepared', 'claimed_for_dispatch', 'sealed_before_dispatch'))
          );
        """)

    first = fixture()
    prepare("A", *first)
    assert outcome("A", *first) == "unknown"
    assert outcome("B", *first) == "unknown"
    assert sql("A", SEAL, first[0], "cart_n03_unrelated") == "0"
    assert sql("A", SEAL, *first) == "1"
    assert outcome("A", *first) == "no_order"
    assert sql("A", CLAIM, *first) == "0"
    assert sql("A", SEAL, *first) == "0"
    prepare("B", *first)
    assert sql("B", CLAIM, *first) == "1"
    assert outcome("B", *first) == "unknown"
    assert outcome("A", *first) == "no_order"

    rolled_back = fixture()
    prepare("A", *rolled_back)
    lose_session("A", *rolled_back, committed=False)
    assert outcome("A", *rolled_back) == "unknown"
    assert sql("A", SEAL, *rolled_back) == "1"
    assert outcome("A", *rolled_back) == "no_order"
    assert sql("A", CLAIM, *rolled_back) == "0"

    committed = fixture()
    prepare("B", *committed)
    lose_session("B", *committed, committed=True)
    assert outcome("B", *committed) == "unknown"
    assert sql("B", SEAL, *committed) == "0"
    assert sql("B", CLAIM, *committed) == "0"

    for competing_writes in ((CLAIM, CLAIM), (CLAIM, SEAL)):
        attempt = fixture()
        prepare("A", *attempt)
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = [
                workers.submit(sql, "A", statement, *attempt)
                for statement in competing_writes
            ]
            writes = [result.result() for result in results]
        assert sorted(writes) == ["0", "1"]
        winner = competing_writes[writes.index("1")]
        assert outcome("A", *attempt) == ("no_order" if winner == SEAL else "unknown")
        assert sql("A", CLAIM, *attempt) == "0"
        assert sql("A", SEAL, *attempt) == "0"

    print("SHQIPSHOP_N03_ATTEMPT_LEDGER_DISPATCH_FENCE_CI_PASSED")


if __name__ == "__main__":
    main()
