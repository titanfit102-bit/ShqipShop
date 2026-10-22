import re
from app.db import database
from app.services import CommerceError

VALID={'idempotency_key':'test_key_12345678','customer_name':'Klient Test','customer_phone':'+355691234567',
       'city':'Tiranë','address':'Rruga e Dibrës 13','note':'', 'accept_privacy':True}

def test_home_and_store_render(seeded):
    client,_,_,xprod,_=seeded
    assert client.get('/').status_code==200
    resp=client.get('/s/shop-alpha')
    assert resp.status_code==200 and 'Këmishë' in resp.text
    assert 'Parfum' not in resp.text
    assert client.get('/s/shop-beta').status_code==200
    assert client.get('/s/nope').status_code==404
    assert client.get('/s/shop-alpha/manifest.webmanifest').json()['lang']=='sq-AL'
    assert client.get('/s/shop-alpha/icon.svg').status_code==200
    png=client.get('/s/shop-alpha/icon-192.png')
    assert png.status_code==200 and png.content.startswith(b'\x89PNG')
    assert client.get('/s/shop-alpha/').status_code==200
    assert client.get('/s/shop-alpha/service-worker.js').status_code==200
    assert client.get('/healthz').json()=={'status':'ok'}

def test_order_atomic_stock_tenant_isolation_and_idempotency(seeded):
    client,alpha,beta,xprod,yprod=seeded
    payload={**VALID,'items':[{'product_id':xprod,'quantity':3}]}
    resp=client.post('/api/stores/shop-alpha/orders',json=payload)
    assert resp.status_code==201,resp.text
    body=resp.json();assert body['total']==7500 and body['tracking_token']
    assert client.get('/api/stores/shop-alpha/track/'+body['tracking_token']).json()['status']=='new'
    assert client.get('/api/stores/shop-beta/track/'+body['tracking_token']).status_code==404
    assert client.post('/api/stores/shop-alpha/orders',json=payload).json()['replayed'] is True
    assert client.post('/api/stores/shop-alpha/orders',json={**payload,'address':'Different street 25'}).status_code==409
    with database() as conn:
        assert conn.execute('SELECT stock FROM products WHERE id=?',(xprod,)).fetchone()['stock']==1
        assert conn.execute('SELECT COUNT(*) c FROM orders').fetchone()['c']==1
    failed=client.post('/api/stores/shop-alpha/orders',json={**VALID,'idempotency_key':'different_key_12','items':[{'product_id':xprod,'quantity':2}]})
    assert failed.status_code==409
    cross=client.post('/api/stores/shop-alpha/orders',json={**VALID,'idempotency_key':'different_key_13','items':[{'product_id':yprod,'quantity':1}]})
    assert cross.status_code==400
    assert client.get('/api/stores/shop-alpha/products').json()['products'][0]['name']=='Këmishë'

def test_validation_and_privacy(seeded):
    client,alpha,beta,xprod,yprod=seeded
    payload={**VALID,'items':[{'product_id':xprod,'quantity':1}]}
    assert client.post('/api/stores/shop-alpha/orders',json={**payload,'accept_privacy':False}).status_code==400
    assert client.post('/api/stores/shop-alpha/orders',json={**payload,'customer_phone':'abc'}).status_code==422
    assert client.post('/api/stores/shop-alpha/orders',json={**payload,'items':[{'product_id':xprod,'quantity':999}]}).status_code==422
    assert client.post('/api/stores/shop-alpha/orders',json={**payload,'items':[{'product_id':xprod,'quantity':1},{'product_id':xprod,'quantity':1}]}).status_code==400

def test_admin_session_tenant_and_csrf(seeded,alpha_login):
    client,csrf=alpha_login
    assert client.get('/admin/shop-beta',follow_redirects=False).status_code==303
    assert client.post('/admin/shop-beta/settings',data={'csrf':csrf,'name':'HACK','color':'#123456','city':'Tiranë'},follow_redirects=False).status_code==401
    assert client.post('/admin/shop-alpha/products',data={'csrf':'bad','name':'Prodhim','price':'100','stock':'2'},follow_redirects=False).status_code==403
    assert client.post('/admin/shop-alpha/products',data={'csrf':csrf,'name':'Prodhim','price':'100','stock':'2'},follow_redirects=False).status_code==303
    assert client.get('/s/shop-alpha').text.count('Prodhim')>=1
    r=client.post('/admin/shop-alpha/settings',data={'csrf':csrf,'name':'Alpha New','tagline':'Mirë se erdhët','color':'#005544','city':'Berat','delivery_fee':'200'},follow_redirects=False)
    assert r.status_code==303
    assert client.get('/s/shop-alpha').status_code==200
    assert client.post('/admin/shop-alpha/logout',data={'csrf':csrf},follow_redirects=False).status_code==303
    assert client.get('/admin/shop-alpha',follow_redirects=False).status_code==303

def test_order_status_and_cancel_restores_stock(seeded,alpha_login):
    client,csrf=alpha_login
    with database() as conn:
        pid=conn.execute("SELECT id FROM products WHERE name='Këmishë'").fetchone()['id']
    response=client.post('/api/stores/shop-alpha/orders',json={**VALID,'items':[{'product_id':pid,'quantity':2}]})
    order=response.json()['order_id']
    assert client.post(f'/admin/shop-alpha/orders/{order}/status',data={'csrf':csrf,'status':'shipped'},follow_redirects=False).status_code==409
    assert client.post(f'/admin/shop-alpha/orders/{order}/status',data={'csrf':csrf,'status':'cancelled'},follow_redirects=False).status_code==303
    with database() as conn:
        assert conn.execute('SELECT stock FROM products WHERE id=?',(pid,)).fetchone()['stock']==4
    assert client.post(f'/admin/shop-alpha/orders/{order}/status',data={'csrf':csrf,'status':'confirmed'},follow_redirects=False).status_code==409

def test_xss_is_escaped(seeded,alpha_login):
    client,csrf=alpha_login
    name='<script>alert(1)</script>'
    resp=client.post('/admin/shop-alpha/products',data={'csrf':csrf,'name':name,'price':'999','stock':'2'},follow_redirects=False)
    assert resp.status_code==303
    html=client.get('/s/shop-alpha').text
    assert name not in html and '&lt;script&gt;' in html

def test_password_fail_and_no_admin_leaks(seeded):
    client,*_=seeded
    bad=client.post('/admin/shop-alpha/login',data={'email':'alpha@example.invalid','password':'wrong'},follow_redirects=False)
    assert bad.status_code==401
    assert 'Email ose fjalëkalim i pasaktë' in bad.text
    assert client.get('/admin/shop-alpha',follow_redirects=False).status_code==303
