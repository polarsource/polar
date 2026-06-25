import time
import typing
import uuid

import structlog
from authlib.oauth2.rfc6749.grants import RefreshTokenGrant as _RefreshTokenGrant
from sqlalchemy import select

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.models import OAuth2Token, User, UserOrganization

from ..sub_type import SubType, SubTypeValue

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer

log = structlog.get_logger()


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
        # Migrate legacy organization tokens to user tokens down-scoped to the
        # org when the org has a single, unambiguous member. Multi-member orgs
        # can't be disambiguated, so they stay org-bound and age out.
        if refresh_token.sub_type == SubType.organization:
            organization_id = refresh_token.organization_id
            assert organization_id is not None
            member = self._single_member(organization_id)
            if member is not None:
                log.info(
                    "oauth2.organization_token_migrated_to_user",
                    token_id=str(refresh_token.id),
                    client_id=refresh_token.client_id,
                    organization_id=str(organization_id),
                    user_id=str(member.id),
                )
                self.request.organization_ids = [organization_id]
                return SubType.user, member
            self.request.organization_ids = []
            return refresh_token.get_sub_type_value()

        self.request.organization_ids = [
            scope.organization_id for scope in refresh_token.organization_scopes
        ]
        return refresh_token.get_sub_type_value()

    def _single_member(self, organization_id: uuid.UUID) -> User | None:
        statement = (
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)
            .where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.is_deleted.is_(False),
            )
        )
        members = self.server.session.execute(statement).unique().scalars().all()
        if len(members) == 1:
            return members[0]
        return None

    def revoke_old_credential(self, refresh_token: OAuth2Token) -> None:
        refresh_token.refresh_token_revoked_at = int(time.time())  # pyright: ignore
        self.server.session.add(refresh_token)
        self.server.session.flush()
