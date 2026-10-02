from fastapi import Depends
from reauth.factors.oauth2.base import OAuth2Account, OAuth2GetProfileException
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from reauth.factors.oauth2.google import GoogleOAuth2Factor as GoogleOAuth2FactorBase

from polar.auth.exceptions import GetEmailError
from polar.config import settings
from polar.postgres import AsyncSession, get_db_session

from .factor import OAuth2FactorMixin
from .state import OAuth2StateService, get_oauth2_state_service


class GoogleFactor(OAuth2FactorMixin, GoogleOAuth2FactorBase):
    IDENTIFIER = "google"
    SCOPE = ["openid", "email", "profile"]

    def __init__(
        self, session: AsyncSession, state_service: OAuth2StateService
    ) -> None:
        self.session = session
        super().__init__(
            identifier=self.IDENTIFIER,
            state_service=state_service,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )

    async def get_email(
        self, callback_result: OAuth2EnrollmentDataclass | OAuth2Account
    ) -> str:
        if callback_result.id_token is not None:
            try:
                claims = await self.get_id_token_claims(callback_result.id_token)
                return claims["email"]
            except KeyError as e:
                raise GetEmailError() from e

        try:
            profile = await self.get_profile(callback_result.access_token)
            return profile["email"]
        except (KeyError, OAuth2GetProfileException) as e:
            raise GetEmailError() from e


async def get_google_factor(
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> GoogleFactor:
    return GoogleFactor(session, state_service)
