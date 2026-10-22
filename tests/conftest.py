import pytest
from fastapi.testclient import TestClient
from app.db import init_db, database
from app.main import app, _attempts
from app.security import hash_password
from app.services import create_merchant, create_product

@pytest.fixture
def seeded(monkeypatch,tmp_path):
    monkeypatch.setenv('SHQIPSHOP_DB',str(tmp_path/'pilot.db'))
    _attempts.clear()
    init_db()
    with database() as conn:
        x=create_merchant(conn,'shop-alpha','Shop Alpha','alpha@example.invalid',hash_password('long-password-alpha!'))
        y=create_merchant(conn,'shop-beta','Shop Beta','beta@example.invalid',hash_password('long-password-beta!'))
        xprod=create_product(conn,x,name='Këmishë',category='Veshje',description='Test',price=2500,stock=4)
        yprod=create_product(conn,y,name='Parfum',category='Parfume',description='Test',price=5000,stock=2)
    with TestClient(app) as client:
        yield client,x,y,xprod,yprod

@pytest.fixture
def alpha_login(seeded):
    client,*_=seeded
    resp=client.post('/admin/shop-alpha/login',data={'email':'alpha@example.invalid','password':'long-password-alpha!'},follow_redirects=False)
    assert resp.status_code==303
    page=client.get('/admin/shop-alpha')
    assert page.status_code==200
    import re
    csrf=re.search(r'name="csrf" value="([^"]+)"',page.text).group(1)
    return client,csrf
