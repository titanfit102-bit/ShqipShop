"""SQLite storage for local pilots; tenant-scoped operations are mandatory."""
from __future__ import annotations
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = lambda: os.environ.get('SHQIPSHOP_DB', str(Path(__file__).resolve().parent.parent / 'var' / 'shop.db'))

DDL = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS merchants (
 id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 tagline TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '#175c52', city TEXT NOT NULL DEFAULT 'Tiranë',
 currency TEXT NOT NULL DEFAULT 'ALL', delivery_fee INTEGER NOT NULL DEFAULT 0,
 contact_phone TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, merchant_id INTEGER NOT NULL REFERENCES merchants(id),
 email TEXT NOT NULL, password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(merchant_id,email)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, merchant_id INTEGER NOT NULL REFERENCES merchants(id),
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Produkte',
 price INTEGER NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0),
 image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_products_tenant_active ON products(merchant_id,active);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY, merchant_id INTEGER NOT NULL REFERENCES merchants(id),
 idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL DEFAULT '', tracking_hash TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 city TEXT NOT NULL, address TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'cod',
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','confirmed','shipped','delivered','cancelled')),
 subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL, total INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(merchant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_orders_merchant_status ON orders(merchant_id,status);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id INTEGER REFERENCES products(id), product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price INTEGER NOT NULL, line_total INTEGER NOT NULL
);
"""

def connect() -> sqlite3.Connection:
    path = DB_PATH()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=10000')
    return conn

def init_db():
    with connect() as conn:
        conn.executescript(DDL)
        cols = [row['name'] for row in conn.execute('PRAGMA table_info(orders)')]
        if 'request_hash' not in cols:
            conn.execute("ALTER TABLE orders ADD COLUMN request_hash TEXT NOT NULL DEFAULT ''")

@contextmanager
def database():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
