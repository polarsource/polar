import typing

from polar.config import settings

from .authorization_code import (
    AuthorizationCodeGrant,
    CodeChallenge,
    OpenIDCode,
    ValidateSubAndPrompt,
)
from .claim import ClaimGrant
from .jwt_bearer import JWTBearerGrant
from .refresh_token import RefreshTokenGrant
from .web import WebGrant

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer


def register_grants(server: "AuthorizationServer") -> None:
    server.register_grant(
        AuthorizationCodeGrant,
        [
            CodeChallenge(),
            OpenIDCode(server.session, require_nonce=False),
            ValidateSubAndPrompt(server.session),
        ],
    )
    server.register_grant(RefreshTokenGrant)
    server.register_grant(WebGrant)
    if settings.AGENT_SIGN_UP_ENABLED:
        server.register_grant(JWTBearerGrant)
        server.register_grant(ClaimGrant)


__all__ = ["AuthorizationCodeGrant", "CodeChallenge", "register_grants"]
