"""Merchant password hashing and opaque DB-backed sessions."""
import hashlib
import hmac
import secrets
import time

SESSION_SECONDS = 60 * 60 * 12

def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError('Fjalëkalimi duhet të ketë të paktën 12 karaktere.')
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode('utf8'), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f'scrypt$16384${salt.hex()}${derived.hex()}'

def verify_password(password: str, encoded: str) -> bool:
    try:
        alg, work, salt, digest = encoded.split('$')
        if alg != 'scrypt' or int(work) != 16384:
            return False
        check = hashlib.scrypt(password.encode('utf8'), salt=bytes.fromhex(salt), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(check, bytes.fromhex(digest))
    except (ValueError, TypeError):
        return False

def new_session(conn, user_id: int):
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    conn.execute('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',
                 (sha(token), user_id, csrf, int(time.time()) + SESSION_SECONDS))
    return token, csrf

def sha(token: str) -> str:
    return hashlib.sha256(token.encode('utf8')).hexdigest()

def get_session(conn, token: str | None):
    if not token:
        return None
    return conn.execute('''SELECT s.*,u.merchant_id,u.email FROM sessions s
        JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?''',
        (sha(token), int(time.time()))).fetchone()

def require_csrf(session, provided: str | None) -> bool:
    return bool(session and provided and hmac.compare_digest(session['csrf'], provided))
