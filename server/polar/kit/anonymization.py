import hashlib


def anonymize_for_deletion(value: str) -> str:
    ret = hashlib.sha256()
    ret.update(value.encode("utf-8"))
    return ret.hexdigest()


ANONYMIZED_EMAIL_DOMAIN = "anonymized.invalid"


def anonymize_email_for_deletion(email: str) -> str:
    assert "@" in email

    # user, domain = email.split('@')
    return f"{anonymize_for_deletion(email)}@{ANONYMIZED_EMAIL_DOMAIN}"
