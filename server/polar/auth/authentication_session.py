import typing
import uuid
from datetime import UTC, datetime

from fastapi import Depends, Request, Response
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.authentication_session import (
    AuthenticationSessionService as AuthenticationSessionServiceBase,
)
from reauth.authentication_session import (
    ExpiredSessionException,
    InvalidSessionTokenException,
)
from reauth.factors import FactorBase
from sqlalchemy import delete, select, update

from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.http import is_localhost
from polar.models import AuthenticationSession
from polar.postgres import AsyncSession, get_db_session

from .factors import get_factors
from .schemas import AuthenticationSession as AuthenticationSessionSchema

TOKEN_PREFIX = "polar_auth_session_"


class AuthenticationSessionException(PolarError): ...


class InvalidAuthenticationSession(AuthenticationSessionException):
    def __init__(self) -> None:
        super().__init__("Invalid or missing authentication session token.", 401)


class AuthenticationSessionService(AuthenticationSessionServiceBase):
    def __init__(
        self, session: AsyncSession, factors: set[FactorBase[typing.Any]]
    ) -> None:
        self.session = session
        super().__init__(
            hash_secret=settings.SECRET,
            factors=factors,
            token_prefix=TOKEN_PREFIX,
            lifetime=settings.AUTHENTICATION_SESSION_TTL,
        )

    async def insert(
        self, authentication_session: AuthenticationSessionDataclass
    ) -> uuid.UUID:
        authentication_session_orm = AuthenticationSession(
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
        statement = select(AuthenticationSession).where(
            AuthenticationSession.token_hash == token_hash
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
            update(AuthenticationSession)
            .where(AuthenticationSession.id == authentication_session.id)
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
        statement = delete(AuthenticationSession).where(
            AuthenticationSession.id == authentication_session.id
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def set_cookie(
        self, request: Request, response: Response, value: str, expires_at: int
    ) -> None:
        expires_datetime = datetime.fromtimestamp(expires_at, tz=UTC)
        response.set_cookie(
            key=settings.AUTHENTICATION_SESSION_COOKIE_KEY,
            value=value,
            domain=settings.AUTHENTICATION_SESSION_COOKIE_DOMAIN,
            path="/",
            httponly=True,
            secure=not is_localhost(request),
            samesite="lax",
            expires=expires_datetime,
        )

    async def to_schema(
        self, authentication_session: AuthenticationSessionDataclass
    ) -> AuthenticationSessionSchema:
        factors = await self.get_available_factors(authentication_session)
        return AuthenticationSessionSchema.from_session_and_factors(
            authentication_session, factors
        )

    async def get_from_request(
        self, request: Request
    ) -> AuthenticationSessionDataclass:
        token = request.cookies.get(settings.AUTHENTICATION_SESSION_COOKIE_KEY)
        if token is None:
            raise InvalidSessionTokenException()
        return await self.get_by_token(token)


async def get_authentication_session_service(
    session: AsyncSession = Depends(get_db_session),
    factors: set[FactorBase[typing.Any]] = Depends(get_factors),
) -> AuthenticationSessionService:
    return AuthenticationSessionService(session, factors)


async def get_optional_authentication_session(
    request: Request,
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
) -> AuthenticationSessionDataclass | None:
    token = request.cookies.get(settings.AUTHENTICATION_SESSION_COOKIE_KEY)
    if token is None:
        return None
    try:
        return await authentication_session_service.get_by_token(token)
    except (InvalidSessionTokenException, ExpiredSessionException):
        return None


async def get_authentication_session(
    authentication_session: AuthenticationSessionDataclass | None = Depends(
        get_optional_authentication_session
    ),
) -> AuthenticationSessionDataclass:
    if authentication_session is None:
        raise InvalidAuthenticationSession()
    return authentication_session
