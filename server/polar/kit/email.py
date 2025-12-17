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


__all__ = ["EmailNotValidError", "EmailStrDNS", "validate_email"]
