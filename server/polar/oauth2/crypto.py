import secrets


def generate_token(prefix: str) -> str:
    return prefix + secrets.token_urlsafe()
