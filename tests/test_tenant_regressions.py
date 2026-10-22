"""Regression checks for merchant authorization and tenant-scoped commerce."""

from app.db import database


BASE = {
    'idempotency_key': 'tenant_key_123456',
    'customer_name': 'Klient Test',
    'customer_phone': '+355691234567',
    'city': 'Tiranë',
    'address': 'Rruga e Dibrës 13',
    'note': '',
    'accept_privacy': True,
}


def test_admin_cannot_edit_another_tenants_product(seeded, alpha_login):
    client, alpha, beta, xprod, yprod = seeded
    _, csrf = alpha_login
    response = client.post(
        f'/admin/shop-alpha/products/{yprod}/update',
        data={'csrf': csrf, 'stock': 0, 'active': 0},
        follow_redirects=False,
    )
    assert response.status_code == 404
    with database() as conn:
        item = conn.execute(
            'SELECT stock, active, merchant_id FROM products WHERE id=?',
            (yprod,),
        ).fetchone()
    assert dict(item) == {'stock': 2, 'active': 1, 'merchant_id': beta}


def test_idempotency_keys_are_isolated_per_merchant(seeded):
    client, alpha, beta, xprod, yprod = seeded
    first = client.post('/api/stores/shop-alpha/orders', json={
        **BASE, 'items': [{'product_id': xprod, 'quantity': 1}],
    })
    second = client.post('/api/stores/shop-beta/orders', json={
        **BASE, 'items': [{'product_id': yprod, 'quantity': 1}],
    })
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert second.json()['replayed'] is False
    with database() as conn:
        rows = conn.execute(
            'SELECT merchant_id FROM orders WHERE idempotency_key=? ORDER BY merchant_id',
            (BASE['idempotency_key'],),
        ).fetchall()
    assert [r['merchant_id'] for r in rows] == [alpha, beta]
