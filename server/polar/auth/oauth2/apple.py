import uuid

from fastapi import Depends
from reauth.factors.oauth2.apple import AppleOAuth2Factor as AppleOAuth2FactorBase
from reauth.factors.oauth2.base import OAuth2Account
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from sqlalchemy import update

from polar.config import settings
from polar.models import OAuthAccount
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession, get_db_session

from ..exceptions import GetEmailError
from .factor import OAuth2FactorMixin
from .state import OAuth2StateService, get_oauth2_state_service


class AppleFactor(OAuth2FactorMixin, AppleOAuth2FactorBase):
    IDENTIFIER = "apple"
    SCOPE = ["openid", "email", "name"]

    def __init__(
        self, session: AsyncSession, state_service: OAuth2StateService
    ) -> None:
        self.session = session
        super().__init__(
            identifier=self.IDENTIFIER,
            state_service=state_service,
            client_id=settings.APPLE_CLIENT_ID,
            team_id=settings.APPLE_TEAM_ID,
            key_id=settings.APPLE_KEY_ID,
            key_value=settings.APPLE_KEY_VALUE,
        )

    async def insert(self, enrollment: OAuth2EnrollmentDataclass) -> uuid.UUID:
        assert enrollment.id_token is not None, (
            "ID token is required for Apple enrollment"
        )
        claims = await self.get_id_token_claims(enrollment.id_token)
        enrollment_orm = OAuthAccount(
            platform=OAuthPlatform.apple,
            access_token=enrollment.access_token,
            expires_at=enrollment.expires_at,
            refresh_token=enrollment.refresh_token,
            refresh_token_expires_at=enrollment.refresh_token_expires_at,
            account_id=enrollment.account_id,
            account_email=claims["email"],
            account_username=claims.get("name"),
            user_id=enrollment.identity_id,
        )
        self.session.add(enrollment_orm)
        await self.session.flush()
        return enrollment_orm.id

    async def update(self, enrollment: OAuth2EnrollmentDataclass) -> None:
        statement = (
            update(OAuthAccount)
            .where(
                OAuthAccount.user_id == enrollment.identity_id,
                OAuthAccount.platform == OAuthPlatform(self.identifier),
            )
            .values(
                access_token=enrollment.access_token,
                expires_at=enrollment.expires_at,
                refresh_token=enrollment.refresh_token,
                refresh_token_expires_at=enrollment.refresh_token_expires_at,
                # Apple doesn't provide profile information on subsequent login,
                # so we don't update account_email and account_username on update.
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def get_email(
        self, callback_result: OAuth2EnrollmentDataclass | OAuth2Account
    ) -> str:
        if callback_result.id_token is None:
            raise GetEmailError()

        claims = await self.get_id_token_claims(callback_result.id_token)
        try:
            return claims["email"]
        except KeyError as e:
            raise GetEmailError() from e


async def get_apple_factor(
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> AppleFactor:
    return AppleFactor(session, state_service)
