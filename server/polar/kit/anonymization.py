import hashlib
from datetime import datetime


def anonymize_for_deletion(value: str, created_at: datetime) -> str:
    ret = hashlib.sha256()
    ret.update(created_at.isoformat().encode("utf-8"))
    ret.update(value.encode("utf-8"))
    return ret.hexdigest()


ANONYMIZED_EMAIL_DOMAIN = "anonymized.polar.sh"


def anonymize_email_for_deletion(email: str, created_at: datetime) -> str:
    assert "@" in email

    return f"{anonymize_for_deletion(email, created_at)}@{ANONYMIZED_EMAIL_DOMAIN}"
