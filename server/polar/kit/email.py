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


# Alternate domains that deliver to the same mailbox as their canonical one.
_DOMAIN_ALIASES = {"googlemail.com": "gmail.com"}

# Characters the provider ignores in the local part, keyed by canonical domain
# since aliases are resolved first. Proton treats periods, hyphens and
# underscores alike; Proton's four domains are separate mailboxes, not aliases.
_TRANSPARENT_LOCAL_PART_CHARS = {
    "gmail.com": ".",
    "proton.me": ".-_",
    "protonmail.com": ".-_",
    "protonmail.ch": ".-_",
    "pm.me": ".-_",
}


def normalize_email(email: str) -> str:
    """Reduce an email address to the mailbox it actually delivers to.

    On top of `unalias_email`, the local part is lowercased and each provider's
    own addressing rules are applied: `googlemail.com` is an alias of
    `gmail.com`, Gmail ignores dots in the local part, and Proton ignores dots,
    hyphens and underscores. So `Pieter.Smith+123@googlemail.com` and
    `pietersmith@gmail.com` are the same mailbox and both normalize to the
    latter. The domain is lowercased by `validate_email_syntax`.

    Used as an identity key for abuse checks, where an address a customer can
    trivially vary must not buy them a second redemption.
    """
    parsed = validate_email_syntax(email)
    local_part = parsed.local_part.split("+", 1)[0].lower()
    domain = _DOMAIN_ALIASES.get(parsed.domain, parsed.domain)

    transparent = _TRANSPARENT_LOCAL_PART_CHARS.get(domain, "")
    local_part = local_part.translate(str.maketrans("", "", transparent))

    return f"{local_part}@{domain}"


__all__ = [
    "EmailNotValidError",
    "EmailStrDNS",
    "normalize_email",
    "unalias_email",
    "validate_email",
    "validate_email_syntax",
]
