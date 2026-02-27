from app.config import settings

_fernet = None


def get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = settings.get_fernet()
    return _fernet


def encrypt(plaintext: str) -> str:
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return get_fernet().decrypt(ciphertext.encode()).decode()
