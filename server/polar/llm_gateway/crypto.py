from cryptography.fernet import Fernet

from polar.config import settings


def _get_fernet() -> Fernet:
    key = settings.LLM_GATEWAY_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "LLM_GATEWAY_ENCRYPTION_KEY is not set. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return Fernet(key.encode())


def encrypt_api_key(api_key: str) -> str:
    return _get_fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()
