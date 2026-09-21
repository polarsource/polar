import functools
from typing import Annotated

import email_validator
from email_validator import EmailNotValidError, caching_resolver
from email_validator import validate_email as _validate_email
from pydantic import AfterValidator, EmailStr
from pydantic_core import PydanticCustomError

from polar.config import settings

if settings.is_testing():
    email_validator.TEST_ENVIRONMENT = True

_email_dns_resolver = caching_resolver()

validate_email = functools.partial(
    _validate_email, check_deliverability=True, dns_resolver=_email_dns_resolver
)
validate_email_syntax = functools.partial(_validate_email, check_deliverability=False)


def _validate_email_dns(email: str) -> str:
    try:
        validate_email(email)
    except EmailNotValidError as e:
        raise PydanticCustomError(
            "value_error",
            "{email} is not a valid email address: {reason}",
            {"email": email, "reason": str(e)},
        ) from e
    else:
        return email


EmailStrDNS = Annotated[EmailStr, AfterValidator(_validate_email_dns)]


def unalias_email(email: str) -> str:
    """Strip the `+alias` suffix from the local part of an email address.

    For example, `pieter+123@polar.sh` becomes `pieter@polar.sh`. The domain is
    preserved as-is. Used to compare email addresses while ignoring sub-addressing.
    """
    parsed = validate_email_syntax(email)
    return f"{parsed.local_part.split('+', 1)[0]}@{parsed.domain}"


_GOOGLE_MAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def normalize_email(email: str) -> str:
    """Reduce an email address to the mailbox it actually delivers to.

    On top of `unalias_email`, the local part is lowercased and Google's own
    addressing rules are applied: `googlemail.com` is an alias of `gmail.com`,
    and Gmail ignores dots in the local part. So `Pieter.Smith+123@googlemail.com`
    and `pietersmith@gmail.com` are the same mailbox and both normalize to the
    latter. The domain is lowercased by `validate_email_syntax`.

    Used as an identity key for abuse checks, where an address a customer can
    trivially vary must not buy them a second redemption.
    """
    parsed = validate_email_syntax(email)
    local_part = parsed.local_part.split("+", 1)[0].lower()
    domain = parsed.domain

    if domain in _GOOGLE_MAIL_DOMAINS:
        domain = "gmail.com"
        local_part = local_part.replace(".", "")

    return f"{local_part}@{domain}"


__all__ = [
    "EmailNotValidError",
    "EmailStrDNS",
    "normalize_email",
    "unalias_email",
    "validate_email",
    "validate_email_syntax",
]
