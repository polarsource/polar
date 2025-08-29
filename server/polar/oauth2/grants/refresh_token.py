import time
import typing

from authlib.oauth2.rfc6749.grants import RefreshTokenGrant as _RefreshTokenGrant
from sqlalchemy import select

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.models import OAuth2Token

from ..sub_type import SubTypeValue

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer


class RefreshTokenGrant(_RefreshTokenGrant):
    server: "AuthorizationServer"

    INCLUDE_NEW_REFRESH_TOKEN = True
    TOKEN_ENDPOINT_AUTH_METHODS = ["client_secret_basic", "client_secret_post", "none"]

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

    def authenticate_user(self, refresh_token: OAuth2Token) -> SubTypeValue | None:
        return refresh_token.get_sub_type_value()

    def revoke_old_credential(self, refresh_token: OAuth2Token) -> None:
        refresh_token.refresh_token_revoked_at = int(time.time())  # pyright: ignore
        self.server.session.add(refresh_token)
        self.server.session.flush()
