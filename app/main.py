"""FastAPI white-label shop pilot. This is NOT a Medusa backend."""
from __future__ import annotations
import hashlib
import os
import re
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from .db import database, init_db
from .security import get_session, hash_password, new_session, require_csrf, sha, verify_password, SESSION_SECONDS
from .services import (COLOR_RE, CommerceError, create_product, merchant_by_slug,
                       place_order, transition_order)

ROOT = Path(__file__).resolve().parent.parent
COOKIE_SECURE = os.environ.get('SHQIPSHOP_SECURE_COOKIES', '0') == '1'

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title='ShqipShop Platform', docs_url=None, redoc_url=None, lifespan=lifespan)
app.mount('/static', StaticFiles(directory=str(ROOT / 'static')), name='static')
templates = Jinja2Templates(directory=str(ROOT / 'templates'))
templates.env.filters['lek'] = lambda v: f'{int(v):,}'.replace(',', '.') + ' Lekë'
_attempts = {}

@app.middleware('http')
async def set_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    resp.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    resp.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    if request.url.path.startswith('/admin/') or request.url.path.startswith('/api/'):
        resp.headers['Cache-Control'] = 'no-store'
    return resp

@app.exception_handler(CommerceError)
async def commerce_error(request, exc):
    if request.url.path.startswith('/api/'):
        return JSONResponse(status_code=exc.status_code, content={'detail':str(exc)})
    return HTMLResponse(f'<h1>Gabim</h1><p>{xml_escape(str(exc))}</p>', status_code=exc.status_code)

def limit_rate(key: str, max_attempts=12, window=60):
    now = time.monotonic()
    attempts = [v for v in _attempts.get(key,[]) if now-v < window]
    if len(attempts) >= max_attempts:
        raise HTTPException(429, detail='Shumë kërkesa. Provo më vonë.')
    attempts.append(now)
    _attempts[key] = attempts
    if len(_attempts) > 20000:
        _attempts.clear()

def context(request, **kwargs):
    return {'request': request, **kwargs}

def admin_guard(conn, request: Request, merchant_id: int):
    session = get_session(conn, request.cookies.get('shop_session'))
    if not session or session['merchant_id'] != merchant_id:
        raise HTTPException(401, 'Hyrja kërkohet')
    return session

@app.get('/', response_class=HTMLResponse)
def homepage(request: Request):
    with database() as conn:
        shops = conn.execute('SELECT * FROM merchants WHERE active=1 ORDER BY created_at DESC LIMIT 24').fetchall()
        return templates.TemplateResponse(request, 'index.html', context(request, shops=shops))

@app.get('/healthz')
def health():
    with database() as conn:
        conn.execute('SELECT 1').fetchone()
    return {'status':'ok'}

@app.get('/s/{slug}', response_class=HTMLResponse)
@app.get('/s/{slug}/', response_class=HTMLResponse)
def storefront(request: Request, slug: str):
    with database() as conn:
        merchant = merchant_by_slug(conn, slug)
        if not merchant: raise HTTPException(404, 'Dyqani nuk u gjet')
        products = conn.execute('''SELECT * FROM products WHERE merchant_id=? AND active=1
                                   ORDER BY id DESC''', (merchant['id'],)).fetchall()
        return templates.TemplateResponse(request, 'store.html', context(request,shop=merchant,products=products))

@app.get('/api/stores/{slug}/products')
def list_products(slug: str):
    with database() as conn:
        merchant = merchant_by_slug(conn,slug)
        if not merchant: raise HTTPException(404,'Dyqani nuk ekziston')
        return {'store':{'name':merchant['name'],'currency':merchant['currency']},
                'products':[dict(p) for p in conn.execute('SELECT id,name,description,category,price,stock,image_url FROM products WHERE merchant_id=? AND active=1',(merchant['id'],))]}

class OrderItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)

class OrderRequest(BaseModel):
    idempotency_key: str = Field(min_length=10,max_length=100)
    customer_name: str = Field(min_length=2,max_length=100)
    customer_phone: str = Field(min_length=8,max_length=19)
    city: str = Field(min_length=2,max_length=80)
    address: str = Field(min_length=5,max_length=240)
    note: str = Field(default='', max_length=400)
    accept_privacy: bool
    items: list[OrderItem] = Field(min_length=1,max_length=50)

@app.post('/api/stores/{slug}/orders', status_code=201)
def order_create(request: Request, slug: str, order: OrderRequest):
    limit_rate(f'order:{slug}:{request.client.host if request.client else "unknown"}', 15, 60)
    if not order.accept_privacy:
        raise CommerceError('Duhet të pranosh njoftimin e privatësisë')
    with database() as conn:
        merchant = merchant_by_slug(conn,slug)
        if not merchant: raise HTTPException(404,'Dyqani nuk ekziston')
        result = place_order(conn,merchant_id=merchant['id'], idempotency_key=order.idempotency_key,
              customer_name=order.customer_name,customer_phone=order.customer_phone,
              city=order.city,address=order.address,note=order.note,
              items=[i.model_dump() for i in order.items])
        # Retries must not expose a tracking token that cannot be reproduced securely.
        return result

@app.get('/api/stores/{slug}/track/{token}')
def order_track(slug: str, token: str):
    if len(token) > 100: raise HTTPException(404, 'Nuk u gjet')
    tokenhash=hashlib.sha256(token.encode()).hexdigest()
    with database() as conn:
        merchant=merchant_by_slug(conn,slug)
        if not merchant: raise HTTPException(404,'Nuk u gjet')
        order=conn.execute('SELECT id,status,created_at FROM orders WHERE merchant_id=? AND tracking_hash=?',
                           (merchant['id'],tokenhash)).fetchone()
        if not order: raise HTTPException(404,'Nuk u gjet')
        return dict(order)

@app.get('/s/{slug}/manifest.webmanifest')
def manifest(slug: str):
    with database() as conn:
        m=merchant_by_slug(conn,slug)
        if not m: raise HTTPException(404)
        data={'name':m['name'],'short_name':m['name'][:14], 'lang':'sq-AL','dir':'ltr',
              'start_url':f'/s/{slug}/', 'scope':f'/s/{slug}/', 'display':'standalone',
              'background_color':'#f5f6f4','theme_color':m['color'],
              'icons':[{'src':f'/s/{slug}/icon-192.png','sizes':'192x192','type':'image/png','purpose':'any maskable'},
                       {'src':f'/s/{slug}/icon-512.png','sizes':'512x512','type':'image/png','purpose':'any maskable'}]}
        return JSONResponse(data, media_type='application/manifest+json')

@app.get('/s/{slug}/icon.svg')
def icon(slug: str):
    with database() as conn:
        m=merchant_by_slug(conn,slug)
        if not m: raise HTTPException(404)
        initials=''.join(x[0] for x in m['name'].split()[:2]).upper()
        letters=xml_escape(initials)
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="{m["color"]}"/><text x="256" y="300" fill="white" font-family="sans-serif" font-weight="bold" font-size="150" text-anchor="middle">{letters}</text></svg>'
        return Response(svg, media_type='image/svg+xml')

@app.get('/s/{slug}/icon-{size}.png')
def icon_png(slug: str, size: int):
    if size not in (192, 512):
        raise HTTPException(404)
    from io import BytesIO
    from PIL import Image, ImageDraw, ImageFont
    with database() as conn:
        m = merchant_by_slug(conn, slug)
        if not m: raise HTTPException(404)
        img = Image.new('RGB', (size, size), m['color'])
        draw = ImageDraw.Draw(img)
        label = ''.join(x[0] for x in m['name'].split()[:2]).upper()
        try:
            font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(size*.3))
        except OSError:
            font=ImageFont.load_default()
        draw.text((size/2, size/2), label, fill='white',font=font,anchor='mm')
        result=BytesIO()
        img.save(result,format='PNG')
        return Response(result.getvalue(), media_type='image/png', headers={'Cache-Control':'no-store'})

@app.get('/s/{slug}/service-worker.js')
def service_worker(slug: str):
    with database() as conn:
        if not merchant_by_slug(conn,slug): raise HTTPException(404)
    js="""self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
// Network-only by design: no caching tenant commerce or personal data.
"""
    return Response(js,media_type='application/javascript',headers={'Service-Worker-Allowed':f'/s/{slug}/'})

@app.get('/admin/{slug}/login', response_class=HTMLResponse)
def login_page(request: Request, slug: str):
    with database() as conn:
        merchant=merchant_by_slug(conn,slug)
        if not merchant: raise HTTPException(404)
        return templates.TemplateResponse(request,'login.html',context(request,shop=merchant,error=''))

@app.post('/admin/{slug}/login')
def login(request: Request, slug: str, email: str=Form(...), password: str=Form(...)):
    limit_rate(f'login:{slug}:{request.client.host if request.client else "unknown"}', 8, 300)
    with database() as conn:
        merchant=merchant_by_slug(conn,slug)
        if not merchant: raise HTTPException(404)
        user=conn.execute('SELECT * FROM users WHERE merchant_id=? AND email=?',
                          (merchant['id'], email.strip().lower())).fetchone()
        if not user or not verify_password(password,user['password_hash']):
            return templates.TemplateResponse(request,'login.html',context(request,shop=merchant,error='Email ose fjalëkalim i pasaktë.'),status_code=401)
        token,_csrf=new_session(conn,user['id'])
        resp=RedirectResponse(f'/admin/{slug}',status_code=303)
        resp.set_cookie('shop_session',token,max_age=SESSION_SECONDS,httponly=True,secure=COOKIE_SECURE,
                        samesite='lax',path='/admin')
        return resp

@app.get('/admin/{slug}', response_class=HTMLResponse)
def dashboard(request: Request,slug: str):
    with database() as conn:
        m=merchant_by_slug(conn,slug)
        if not m: raise HTTPException(404)
        try: s=admin_guard(conn,request,m['id'])
        except HTTPException: return RedirectResponse(f'/admin/{slug}/login',status_code=303)
        products=conn.execute('SELECT * FROM products WHERE merchant_id=? ORDER BY id DESC',(m['id'],)).fetchall()
        orders=conn.execute('SELECT * FROM orders WHERE merchant_id=? ORDER BY id DESC LIMIT 70',(m['id'],)).fetchall()
        revenue=conn.execute("SELECT COALESCE(SUM(total),0) AS amount FROM orders WHERE merchant_id=? AND status='delivered'",(m['id'],)).fetchone()['amount']
        return templates.TemplateResponse(request,'admin.html',context(request,shop=m,session=s,products=products,orders=orders,revenue=revenue,notice=request.query_params.get('notice','')))

def secure_post(request, conn, slug, csrf):
    merchant=merchant_by_slug(conn,slug)
    if not merchant: raise HTTPException(404)
    session=admin_guard(conn,request,merchant['id'])
    if not require_csrf(session,csrf): raise HTTPException(403,'CSRF invalid')
    return merchant,session

@app.post('/admin/{slug}/products')
def add_product(request: Request, slug: str,csrf: str=Form(...), name: str=Form(...),
        category: str=Form('Produkte'),description: str=Form(''), price: int=Form(...),
        stock: int=Form(...), image_url: str=Form('')):
    with database() as conn:
        m,_=secure_post(request,conn,slug,csrf)
        create_product(conn,m['id'], name=name,category=category,description=description,
                       price=price,stock=stock,image_url=image_url)
        return RedirectResponse(f'/admin/{slug}?notice=Produkt+i+ruajtur',status_code=303)

@app.post('/admin/{slug}/products/{product_id}/update')
def update_product(request: Request,slug: str,product_id:int,csrf: str=Form(...),
                   stock:int=Form(...),active:int=Form(...)):
    with database() as conn:
        m,_=secure_post(request,conn,slug,csrf)
        if stock<0 or stock>1_000_000 or active not in (0,1): raise CommerceError('Të dhëna të pavlefshme')
        result=conn.execute('UPDATE products SET stock=?,active=? WHERE id=? AND merchant_id=?',
                            (stock,active,product_id,m['id']))
        if not result.rowcount: raise HTTPException(404)
        return RedirectResponse(f'/admin/{slug}?notice=Produkti+u+p%C3%ABrdit%C3%ABsua',status_code=303)

@app.post('/admin/{slug}/orders/{order_id}/status')
def update_order(request: Request,slug: str,order_id:int,csrf: str=Form(...),status: str=Form(...)):
    with database() as conn:
        m,_=secure_post(request,conn,slug,csrf)
        transition_order(conn,m['id'],order_id,status)
        return RedirectResponse(f'/admin/{slug}?notice=Porosia+u+p%C3%ABrdit%C3%ABsua',status_code=303)

@app.post('/admin/{slug}/settings')
def settings(request: Request,slug: str,csrf: str=Form(...),name: str=Form(...),
             tagline: str=Form(''), color: str=Form(...),city: str=Form(...),
             contact_phone: str=Form(''),delivery_fee:int=Form(0)):
    with database() as conn:
        m,_=secure_post(request,conn,slug,csrf)
        if not (1<=len(name.strip())<=90 and len(tagline)<=180 and 1<=len(city.strip())<=80
                and len(contact_phone)<=25 and COLOR_RE.fullmatch(color) and 0<=delivery_fee<=100000):
            raise CommerceError('Të dhënat e dyqanit janë të pavlefshme')
        conn.execute('UPDATE merchants SET name=?,tagline=?,color=?,city=?,contact_phone=?,delivery_fee=? WHERE id=?',
                     (name.strip(),tagline.strip(),color,city.strip(),contact_phone.strip(),delivery_fee,m['id']))
        return RedirectResponse(f'/admin/{slug}?notice=Dyqani+u+p%C3%ABrdit%C3%ABsua',status_code=303)

@app.post('/admin/{slug}/logout')
def logout(request:Request,slug:str,csrf:str=Form(...)):
    with database() as conn:
        m,s=secure_post(request,conn,slug,csrf)
        conn.execute('DELETE FROM sessions WHERE token_hash=?',(s['token_hash'],))
        resp=RedirectResponse(f'/admin/{slug}/login',status_code=303)
        resp.delete_cookie('shop_session',path='/admin')
        return resp
