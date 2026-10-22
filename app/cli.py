"""Local merchant provisioning. No public signup or hard-coded passwords."""
import argparse
import getpass
import os
import sqlite3
from .db import database, init_db
from .security import hash_password
from .services import create_merchant, create_product

DEMO = [
  ('butiku-era','Butiku Era','#9b5877','Moda që shpreh stilin tënd.', 'Tiranë',
   [('Këmishë lino','Veshje',3290,14,'E lehtë, elegante dhe e përditshme.'),
    ('Çantë City','Aksesorë',5500,8,'Çantë për çdo ditë.'),
    ('Fustan veror','Veshje',4300,12,'Ngjyra dhe rehati.'),
    ('Syze dielli','Aksesorë',1800,24,'Stil për ditët me diell.')]),
  ('tech-alba','Tech Alba','#3f68a8','Aksesorë për teknologjinë tënde.', 'Durrës',
   [('Kufje Bluetooth','Audio',3900,23,'Tingull i pastër dhe lidhje pa kabllo.'),
    ('Karikues USB-C','Aksesorë',1300,28,'Karikim i përditshëm.'),
    ('Mbajtëse telefoni','Aksesorë',950,33,'Praktike për tavolinën.'),
    ('Power Bank','Elektronikë',2900,12,'Karikim kudo.')]),
  ('aroma-studio','Aroma Studio','#b38348','Aroma të zgjedhura për çdo moment.', 'Vlorë',
   [('Parfum Aurora','Parfume',6400,15,'Aromë e ngrohtë me nota lulesh.'),
    ('Set dhuratë','Dhurata',4200,10,'Paketim elegant për çdo rast.'),
    ('Qiri aromatik','Shtëpia',1600,18,'Atmosferë e qetë në shtëpi.'),
    ('Aromatizues ambienti','Shtëpia',2100,22,'Aromë delikate.')]),
]

def demo_seed():
    init_db()
    with database() as conn:
        for slug,name,color,tagline,city,products in DEMO:
            row=conn.execute('SELECT id FROM merchants WHERE slug=?',(slug,)).fetchone()
            if row:
                print('Already exists:',slug)
                continue
            cur=conn.execute('INSERT INTO merchants(slug,name,color,tagline,city) VALUES (?,?,?,?,?)',
                             (slug,name,color,tagline,city))
            for pname,category,price,stock,desc in products:
                create_product(conn,cur.lastrowid,name=pname,category=category,price=price,stock=stock,description=desc)
            print('Demo storefront:', '/s/'+slug)
    print('Demo shops have NO login credentials. Create real merchants separately.')

def main():
    parser=argparse.ArgumentParser(description='ShqipShop local merchant provisioning')
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('init')
    sub.add_parser('seed-demo')
    create=sub.add_parser('create-merchant')
    for flag in ('slug','name','email'):
        create.add_argument('--'+flag, required=True)
    create.add_argument('--password-env',default='SHQIPSHOP_NEW_MERCHANT_PASSWORD')
    args=parser.parse_args()
    if args.command=='init':
        init_db();print('Database initialized.')
    if args.command=='seed-demo':
        demo_seed()
    if args.command=='create-merchant':
        password=os.environ.get(args.password_env) or getpass.getpass('Password (12+ characters): ')
        hp=hash_password(password)
        init_db()
        with database() as conn:
            try:
                mid=create_merchant(conn,args.slug,args.name,args.email,hp)
            except sqlite3.IntegrityError:
                raise SystemExit('Merchant slug or account already exists.')
        print(f'Merchant #{mid} created. Login: /admin/{args.slug}/login')

if __name__=='__main__':
    main()
