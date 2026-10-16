"""Argon2id password hashing and 30-minute, revocable JWT bearer tokens."""
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
import jwt

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))
_hasher = PasswordHasher()
ISSUER = 'edupredict-api'


def _secret() -> str:
    key = os.environ.get('AUTH_SECRET_KEY', '')
    if len(key) < 32:
        raise RuntimeError('Set AUTH_SECRET_KEY to a random secret of at least 32 characters in app/.env')
    return key


def hash_password(password: str) -> str:
    if len(password) < 12 or len(password) > 128:
        raise ValueError('Password must have 12 to 128 characters')
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        'sub': str(user.id), 'v': user.token_version, 'type': 'access',
        'iss': ISSUER, 'iat': now, 'exp': now + timedelta(minutes=30),
    }, _secret(), algorithm='HS256')


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token, _secret(), algorithms=['HS256'], issuer=ISSUER,
        options={'require': ['exp', 'iat', 'iss', 'sub', 'type', 'v']},
    )
