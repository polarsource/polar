import typing
import uuid
from datetime import UTC, datetime

from fastapi import Request, Response
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.authentication_session import (
    AuthenticationSessionService as AuthenticationSessionServiceBase,
)
from reauth.factors import FactorBase
from sqlalchemy import delete, select, update

from polar.config import settings
from polar.kit.crypto import get_legacy_secret
from polar.kit.http import is_localhost
from polar.models import CustomerSessionAuthenticationSession
from polar.postgres import AsyncSession

TOKEN_PREFIX = "polar_customer_auth_session_"


class CustomerSessionAuthenticationSessionService(AuthenticationSessionServiceBase):
    def __init__(
        self, session: AsyncSession, factors: set[FactorBase[typing.Any]]
    ) -> None:
        self.session = session
        super().__init__(
            hash_secret=get_legacy_secret(),
            factors=factors,
            token_prefix=TOKEN_PREFIX,
            lifetime=settings.AUTHENTICATION_SESSION_TTL,
        )

    async def insert(
        self, authentication_session: AuthenticationSessionDataclass
    ) -> uuid.UUID:
        authentication_session_orm = CustomerSessionAuthenticationSession(
            token_hash=authentication_session.token_hash,
            expires_at=authentication_session.expires_at,
            step=authentication_session.step,
            authentication_method_references=authentication_session.amr,
            used_factors=authentication_session.used_factors,
            context=authentication_session.context,
            identity_id=authentication_session.identity_id,
        )
        self.session.add(authentication_session_orm)
        await self.session.flush()
        return authentication_session_orm.id

    async def get_by_token_hash(
        self, token_hash: str
    ) -> AuthenticationSessionDataclass | None:
        statement = select(CustomerSessionAuthenticationSession).where(
            CustomerSessionAuthenticationSession.token_hash == token_hash
        )
        result = await self.session.execute(statement)
        authentication_session = result.scalar_one_or_none()
        if authentication_session is None:
            return None
        return authentication_session.to_dataclass()

    async def update(
        self, authentication_session: AuthenticationSessionDataclass
    ) -> None:
        statement = (
            update(CustomerSessionAuthenticationSession)
            .where(CustomerSessionAuthenticationSession.id == authentication_session.id)
            .values(
                token_hash=authentication_session.token_hash,
                expires_at=authentication_session.expires_at,
                step=authentication_session.step,
                authentication_method_references=authentication_session.amr,
                used_factors=authentication_session.used_factors,
                context=authentication_session.context,
                identity_id=authentication_session.identity_id,
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def delete(
        self, authentication_session: AuthenticationSessionDataclass
    ) -> None:
        statement = delete(CustomerSessionAuthenticationSession).where(
            CustomerSessionAuthenticationSession.id == authentication_session.id
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def set_cookie(
        self, request: Request, response: Response, value: str, expires_at: int
    ) -> None:
        expires_datetime = datetime.fromtimestamp(expires_at, tz=UTC)
        response.set_cookie(
            key=settings.CUSTOMER_SESSION_AUTHENTICATION_SESSION_COOKIE_KEY,
            value=value,
            domain=settings.AUTHENTICATION_SESSION_COOKIE_DOMAIN,
            path="/",
            httponly=True,
            secure=not is_localhost(request),
            samesite="lax",
            expires=expires_datetime,
        )
