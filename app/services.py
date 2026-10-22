"""Tenant-safe commerce operations. Amounts are integers in ALL (lekë)."""
from __future__ import annotations
import hashlib
import json
import re
import secrets
import sqlite3
from dataclasses import dataclass
from typing import Any

SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]{2,44}$')
COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
ORDER_STATES = {'new', 'confirmed', 'shipped', 'delivered', 'cancelled'}

class CommerceError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code

def merchant_by_slug(conn, slug: str):
    if not SLUG_RE.fullmatch(slug):
        return None
    return conn.execute('SELECT * FROM merchants WHERE slug=? AND active=1', (slug,)).fetchone()

def create_merchant(conn, slug: str, name: str, email: str, password_hash: str) -> int:
    if not SLUG_RE.fullmatch(slug):
        raise CommerceError('Slug i pavlefshëm')
    if not name.strip() or '@' not in email:
        raise CommerceError('Emri ose email-i është i pavlefshëm')
    conn.execute('BEGIN IMMEDIATE')
    try:
        cur = conn.execute('INSERT INTO merchants(slug,name) VALUES(?,?)', (slug, name.strip()))
        mid = cur.lastrowid
        conn.execute('INSERT INTO users(merchant_id,email,password_hash) VALUES(?,?,?)',
                     (mid, email.strip().lower(), password_hash))
        conn.commit()
        return mid
    except Exception:
        conn.rollback()
        raise

def create_product(conn, merchant_id: int, *, name: str, category: str, description: str,
                   price: int, stock: int, image_url: str = '') -> int:
    if not name.strip() or len(name) > 130 or len(description) > 1200 or len(category) > 70:
        raise CommerceError('Të dhënat e produktit nuk janë të vlefshme')
    if price < 0 or price > 100_000_000 or stock < 0 or stock > 1_000_000:
        raise CommerceError('Çmim ose stok i pavlefshëm')
    if image_url and not image_url.startswith('https://'):
        raise CommerceError('Lejohen vetëm adresa HTTPS për fotografitë')
    if len(image_url) > 600:
        raise CommerceError('Adresa e fotografisë është shumë e gjatë')
    return conn.execute('''INSERT INTO products(merchant_id,name,category,description,price,stock,image_url)
        VALUES(?,?,?,?,?,?,?)''', (merchant_id, name.strip(), category.strip() or 'Produkte',
                                description.strip(), price, stock, image_url)).lastrowid

def place_order(conn, *, merchant_id: int, idempotency_key: str, customer_name: str,
                customer_phone: str, city: str, address: str, note: str, items: list[dict[str,Any]]):
    if not (10 <= len(idempotency_key) <= 100 and re.fullmatch(r'[a-zA-Z0-9_-]+', idempotency_key)):
        raise CommerceError('Identifikues i porosisë i pavlefshëm')
    if not (2 <= len(customer_name.strip()) <= 100):
        raise CommerceError('Vendosni emrin e klientit')
    if not re.fullmatch(r'\+?[0-9\s-]{8,19}', customer_phone.strip()):
        raise CommerceError('Numri i telefonit është i pavlefshëm')
    if not (2 <= len(city.strip()) <= 80 and 5 <= len(address.strip()) <= 240):
        raise CommerceError('Plotësoni qytetin dhe adresën e saktë')
    if len(note) > 400 or not items or len(items) > 50:
        raise CommerceError('Përmbajtje e pavlefshme e porosisë')
    unique = {}
    for item in items:
        try:
            pid, qty = int(item['product_id']), int(item['quantity'])
        except (ValueError, TypeError, KeyError):
            raise CommerceError('Produkti ose sasia është e pavlefshme')
        if pid <= 0 or qty <= 0 or qty > 100:
            raise CommerceError('Sasi e pavlefshme')
        if pid in unique:
            raise CommerceError('Produkti nuk duhet përsëritur')
        unique[pid] = qty
    signature = hashlib.sha256(json.dumps({
        'items': sorted(unique.items()), 'name': customer_name.strip(),
        'phone': customer_phone.strip(), 'city': city.strip(),
        'address': address.strip(), 'note': note.strip()
    }, ensure_ascii=False, sort_keys=True).encode('utf8')).hexdigest()
    conn.execute('BEGIN IMMEDIATE')
    try:
        previous = conn.execute('SELECT id,request_hash FROM orders WHERE merchant_id=? AND idempotency_key=?',
                                (merchant_id,idempotency_key)).fetchone()
        if previous:
            if previous['request_hash'] != signature:
                raise CommerceError('Identifikues porosie i ripërdorur me të dhëna të ndryshme',409)
            conn.commit()
            return {'order_id': previous['id'], 'replayed': True, 'tracking_token': None}
        merchant = conn.execute('SELECT delivery_fee FROM merchants WHERE id=? AND active=1',
                                (merchant_id,)).fetchone()
        if not merchant:
            raise CommerceError('Dyqani nuk është aktiv', 404)
        lines = []
        for pid, qty in unique.items():
            p = conn.execute('SELECT id,name,price,stock FROM products WHERE merchant_id=? AND id=? AND active=1',
                             (merchant_id,pid)).fetchone()
            if not p:
                raise CommerceError('Produkti nuk ekziston në këtë dyqan')
            if p['stock'] < qty:
                raise CommerceError(f'Stok i pamjaftueshëm për {p["name"]}', 409)
            lines.append((pid, p['name'], qty, p['price'], p['price']*qty))
        subtotal = sum(line[4] for line in lines)
        fee = merchant['delivery_fee']
        token = secrets.token_urlsafe(28)
        cur = conn.execute('''INSERT INTO orders (merchant_id,idempotency_key,request_hash,tracking_hash,customer_name,
         customer_phone,city,address,note,subtotal,delivery_fee,total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
         (merchant_id,idempotency_key,signature,hashlib.sha256(token.encode()).hexdigest(),customer_name.strip(),
          customer_phone.strip(),city.strip(),address.strip(),note.strip(),subtotal,fee,subtotal+fee))
        oid = cur.lastrowid
        for pid,name,qty,unit,total in lines:
            conn.execute('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?)',
                         (oid,pid,name,qty,unit,total))
            conn.execute('UPDATE products SET stock=stock-? WHERE merchant_id=? AND id=? AND stock>=?',
                         (qty,merchant_id,pid,qty))
        conn.commit()
        return {'order_id': oid,'replayed':False,'tracking_token': token, 'total': subtotal+fee}
    except Exception:
        conn.rollback()
        raise

def transition_order(conn, merchant_id: int, order_id: int, status: str):
    if status not in ORDER_STATES:
        raise CommerceError('Status i pavlefshëm')
    transitions = {
      'new': {'confirmed','cancelled'},
      'confirmed': {'shipped','cancelled'},
      'shipped': {'delivered'},
      'delivered': set(), 'cancelled':set()
    }
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute('SELECT status FROM orders WHERE id=? AND merchant_id=?',
                           (order_id,merchant_id)).fetchone()
        if not row: raise CommerceError('Porosia nuk u gjet', 404)
        if status not in transitions[row['status']]:
            raise CommerceError('Kalimi i statusit nuk lejohet', 409)
        if status == 'cancelled':
            lines = conn.execute('SELECT product_id,quantity FROM order_items WHERE order_id=?',
                                 (order_id,)).fetchall()
            for line in lines:
                conn.execute('UPDATE products SET stock=stock+? WHERE id=? AND merchant_id=?',
                             (line['quantity'],line['product_id'], merchant_id))
        conn.execute('UPDATE orders SET status=? WHERE id=? AND merchant_id=?', (status,order_id,merchant_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
