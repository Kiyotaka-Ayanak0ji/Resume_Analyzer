"""Auth + secrets utilities: JWT, password hashing, API key encryption."""
import os
import datetime
import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_ALGO = "HS256"
TOKEN_TTL_DAYS = 7


def _jwt_secret():
    return os.environ["JWT_SECRET"]


def _fernet():
    return Fernet(os.environ["ENCRYPTION_KEY"].encode())


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=TOKEN_TTL_DAYS),
        "iat": datetime.datetime.now(datetime.timezone.utc),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGO)


def decode_token(token: str):
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGO])


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


def mask_key(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "..." + value[-4:]
