from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import Depends, HTTPException
from reauth.crypto import get_token_hash
from reauth.factors.oauth2.base import OAuth2Enrollment
from reauth.factors.oauth2.oidc import OIDCFactor

from polar.auth.oauth2.state import OAuth2StateService
from polar.config import settings
from polar.postgres import AsyncSession, get_db_session

GOOGLE_DISCOVERY_ENDPOINT = (
    "https://accounts.google.com/.well-known/openid-configuration"
)


class BackofficeOAuth2StateService(OAuth2StateService):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self.token_prefix = "polar_backoffice_oauth2_"
        self.hash_secret = get_token_hash(self.token_prefix, secret=self.hash_secret)


async def get_backoffice_oauth2_state_service(
    session: AsyncSession = Depends(get_db_session),
) -> BackofficeOAuth2StateService:
    return BackofficeOAuth2StateService(session)


class BackofficeGoogleFactor(OIDCFactor):
    async def get_enrollment(self, identity_id: UUID) -> OAuth2Enrollment | None:
        return None

    async def get_enrollment_by_provider_and_account(
        self, provider: str, account_id: str
    ) -> OAuth2Enrollment | None:
        return None

    async def insert(self, enrollment: OAuth2Enrollment) -> UUID:
        raise NotImplementedError()

    async def update(self, enrollment: OAuth2Enrollment) -> None:
        raise NotImplementedError()


@asynccontextmanager
async def google_factor(
    state_service: BackofficeOAuth2StateService,
) -> AsyncIterator[BackofficeGoogleFactor]:
    client_id = settings.BACKOFFICE_GOOGLE_CLIENT_ID
    client_secret = settings.BACKOFFICE_GOOGLE_CLIENT_SECRET.get_secret_value()
    if (
        not client_id
        or not client_secret
        or not settings.BACKOFFICE_GOOGLE_HOSTED_DOMAIN.strip()
    ):
        raise HTTPException(status_code=404)
    factor = BackofficeGoogleFactor(
        identifier="backoffice_google",
        client_id=client_id,
        client_secret=client_secret,
        discovery_endpoint=GOOGLE_DISCOVERY_ENDPOINT,
        state_service=state_service,
    )
    async with factor._get_client():
        yield factor


async def get_google_factor(
    state_service: BackofficeOAuth2StateService = Depends(
        get_backoffice_oauth2_state_service
    ),
) -> AsyncIterator[BackofficeGoogleFactor]:
    async with google_factor(state_service) as factor:
        yield factor
