import time
import typing

from authlib.oauth2.rfc6749 import scope_to_list
from authlib.oauth2.rfc6749.grants import (
    AuthorizationCodeGrant as _AuthorizationCodeGrant,
)
from authlib.oauth2.rfc6749.grants import BaseGrant
from authlib.oauth2.rfc6749.grants import (
    RefreshTokenGrant as _RefreshTokenGrant,
)
from authlib.oidc.core import UserInfo
from authlib.oidc.core.grants import (
    OpenIDCode as _OpenIDCode,
)
from authlib.oidc.core.grants import (
    OpenIDToken as _OpenIDToken,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.models import OAuth2AuthorizationCode, OAuth2Client, OAuth2Token, User

from .authorization_server import AuthorizationServer
from .constants import AUTHORIZATION_CODE_PREFIX
from .requests import StarletteOAuth2Request

JWT_CONFIG = {
    "key": settings.JWKS.find_by_kid(settings.CURRENT_JWK_KID),
    "alg": "RS256",
    "iss": "https://polar.sh",
    "exp": 3600,
}


def _exists_nonce(
    session: Session, nonce: str, request: StarletteOAuth2Request
) -> bool:
    statement = select(OAuth2AuthorizationCode).where(
        OAuth2AuthorizationCode.client_id == request.client_id,
        OAuth2AuthorizationCode.nonce == nonce,
    )
    result = session.execute(statement)
    return result.unique().scalar_one_or_none() is not None


def _generate_user_info(user: User, scope: str) -> UserInfo:
    scopes = scope_to_list(scope)
    claims: dict[str, typing.Any] = {"sub": str(user.id)}
    if scopes:
        if "profile" in scopes:
            claims.update({"name": user.username})
        if "email" in scopes:
            claims.update({"email": user.email, "email_verified": user.email_verified})
    return UserInfo(**claims)


class AuthorizationCodeGrant(_AuthorizationCodeGrant):
    server: AuthorizationServer

    def generate_authorization_code(self) -> str:
        return generate_token(prefix=AUTHORIZATION_CODE_PREFIX)

    def save_authorization_code(
        self, code: str, request: StarletteOAuth2Request
    ) -> OAuth2AuthorizationCode:
        nonce = request.data.get("nonce")

        authorization_code = OAuth2AuthorizationCode(
            code=get_token_hash(code, secret=settings.SECRET),
            client_id=request.client_id,
            user_id=request.user.id if request.user else None,
            scope=request.scope,
            redirect_uri=request.redirect_uri,
            nonce=nonce,
        )
        self.server.session.add(authorization_code)
        self.server.session.flush()
        return authorization_code

    def query_authorization_code(
        self, code: str, client: OAuth2Client
    ) -> OAuth2AuthorizationCode | None:
        code_hash = get_token_hash(code, secret=settings.SECRET)
        statement = select(OAuth2AuthorizationCode).where(
            OAuth2AuthorizationCode.code == code_hash,
            OAuth2AuthorizationCode.client_id == client.client_id,
        )
        result = self.server.session.execute(statement)
        authorization_code = result.unique().scalar_one_or_none()
        if authorization_code is not None and not typing.cast(
            bool, authorization_code.is_expired()
        ):
            return authorization_code
        return None

    def delete_authorization_code(
        self, authorization_code: OAuth2AuthorizationCode
    ) -> None:
        self.server.session.delete(authorization_code)
        self.server.session.flush()

    def authenticate_user(
        self, authorization_code: OAuth2AuthorizationCode
    ) -> User | None:
        statement = select(User).where(User.id == authorization_code.user_id)
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()


class OpenIDCode(_OpenIDCode):
    def __init__(self, session: Session, require_nonce: bool = False):
        super().__init__(require_nonce)
        self._session = session

    def exists_nonce(self, nonce: str, request: StarletteOAuth2Request) -> bool:
        return _exists_nonce(self._session, nonce, request)

    def get_jwt_config(self, grant: BaseGrant) -> dict[str, typing.Any]:
        return JWT_CONFIG

    def generate_user_info(self, user: User, scope: str) -> UserInfo:
        return _generate_user_info(user, scope)


class OpenIDToken(_OpenIDToken):
    def get_jwt_config(self, grant: BaseGrant) -> dict[str, typing.Any]:
        return JWT_CONFIG

    def generate_user_info(self, user: User, scope: str) -> UserInfo:
        return _generate_user_info(user, scope)


class RefreshTokenGrant(_RefreshTokenGrant):
    server: AuthorizationServer

    INCLUDE_NEW_REFRESH_TOKEN = True

    def authenticate_refresh_token(self, refresh_token: str) -> OAuth2Token | None:
        refresh_token_hash = get_token_hash(refresh_token, secret=settings.SECRET)
        statement = select(OAuth2Token).where(
            OAuth2Token.refresh_token == refresh_token_hash
        )
        result = self.server.session.execute(statement)
        token = result.unique().scalar_one_or_none()
        if token is not None and not typing.cast(bool, token.is_revoked()):
            return token
        return None

    def authenticate_user(self, refresh_token: OAuth2Token) -> User | None:
        statement = select(User).where(User.id == refresh_token.user_id)
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def revoke_old_credential(self, refresh_token: OAuth2Token) -> None:
        refresh_token.refresh_token_revoked_at = int(time.time())  # pyright: ignore
        self.server.session.add(refresh_token)
        self.server.session.flush()


def register_grants(server: AuthorizationServer) -> None:
    server.register_grant(
        AuthorizationCodeGrant,
        [OpenIDCode(server.session, require_nonce=True), OpenIDToken()],
    )
    server.register_grant(RefreshTokenGrant)


__all__ = ["register_grants", "BaseGrant"]
