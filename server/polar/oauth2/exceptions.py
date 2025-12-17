from typing import Any

from authlib.oauth2.rfc6750 import InvalidTokenError as _InvalidTokenError

from polar.config import settings


class InvalidTokenError(_InvalidTokenError):
    def __init__(self, description: str | None = None, **extra_attributes: Any) -> None:
        super().__init__(
            description, realm=settings.WWW_AUTHENTICATE_REALM, **extra_attributes
        )


class InsufficientScopeError(_InvalidTokenError):
    """The request requires higher privileges than provided by the
    access token. The resource server SHOULD respond with the HTTP
    403 (Forbidden) status code and MAY include the "scope"
    attribute with the scope necessary to access the protected
    resource.

    https://tools.ietf.org/html/rfc6750#section-3.1

    We don't use the one provided by Authlib because it doesn't have
    the logic to handle the headers attribute, contrary to `InvalidTokenError` 🤷‍♂️
    """

    error = "insufficient_scope"
    description = (
        "The request requires higher privileges than provided by the access token."
    )
    status_code = 403

    def __init__(self, required_scopes: set[str]) -> None:
        super().__init__(
            realm=settings.WWW_AUTHENTICATE_REALM, scope=" ".join(required_scopes)
        )


__all__ = ["InsufficientScopeError", "InvalidTokenError"]
