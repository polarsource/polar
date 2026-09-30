from uuid import UUID

import logfire
import structlog
from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param
from starlette.types import ASGIApp, Receive, Send
from starlette.types import Scope as ASGIScope

from polar.authz.service import get_accessible_organization
from polar.config import settings
from polar.customer_session.service import (
    CUSTOMER_SESSION_TOKEN_PREFIX,
)
from polar.customer_session.service import (
    customer_session as customer_session_service,
)
from polar.exception_handlers import polar_exception_handler
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.member_session.service import member_session as member_session_service
from polar.models import (
    CustomerSession,
    MemberSession,
    OAuth2Token,
    Organization,
    OrganizationAccessToken,
    PersonalAccessToken,
    User,
    UserSession,
)
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX
from polar.oauth2.constants import is_access_token_prefix, is_registration_token_prefix
from polar.oauth2.exception_handlers import OAuth2Error, oauth2_error_exception_handler
from polar.oauth2.exceptions import InvalidTokenError
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.organization_access_token.service import (
    TOKEN_PREFIX as ORGANIZATION_ACCESS_TOKEN_PREFIX,
)
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.personal_access_token.service import (
    TOKEN_PREFIX as PERSONAL_ACCESS_TOKEN_PREFIX,
)
from polar.personal_access_token.service import (
    personal_access_token as personal_access_token_service,
)
from polar.postgres import AsyncSession
from polar.rate_limit import clear_cached_identity, write_cached_identity
from polar.redis import Redis
from polar.sentry import set_sentry_user
from polar.worker import enqueue_job

from .exceptions import (
    InvalidRequestedOrganization,
    PolarAuthError,
    RequestedOrganizationNotAccessible,
)
from .models import (
    ORGANIZATION_HEADER,
    Anonymous,
    AuthSubject,
    Subject,
)
from .scope import Scope
from .service import auth as auth_service

log: Logger = structlog.get_logger(__name__)


async def get_user_session(
    request: Request, session: AsyncSession
) -> UserSession | None:
    return await auth_service.authenticate(session, request)


def get_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    scheme, value = get_authorization_scheme_param(authorization)
    if not scheme or not value or scheme.lower() != "bearer":
        return None
    if not value.isascii():
        return None
    return value


async def get_oauth2_token(session: AsyncSession, value: str) -> OAuth2Token | None:
    return await oauth2_token_service.get_by_access_token(session, value)


async def get_personal_access_token(
    session: AsyncSession, value: str
) -> PersonalAccessToken | None:
    token = await personal_access_token_service.get_by_token(session, value)

    if token is not None:
        enqueue_job(
            "personal_access_token.record_usage",
            personal_access_token_id=token.id,
            last_used_at=utc_now().timestamp(),
        )

    return token


async def get_organization_access_token(
    session: AsyncSession, value: str
) -> OrganizationAccessToken | None:
    token = await organization_access_token_service.get_by_token(session, value)

    if token is not None:
        enqueue_job(
            "organization_access_token.record_usage",
            organization_access_token_id=token.id,
            last_used_at=utc_now().timestamp(),
        )

    return token


async def get_customer_session(
    session: AsyncSession, value: str
) -> CustomerSession | None:
    return await customer_session_service.get_by_token(session, value)


async def get_member_session(session: AsyncSession, value: str) -> MemberSession | None:
    return await member_session_service.get_by_token(session, value)


async def get_auth_subject(
    request: Request, session: AsyncSession
) -> AuthSubject[Subject]:
    subject: User | Organization
    credential: (
        UserSession | OAuth2Token | PersonalAccessToken | OrganizationAccessToken
    )
    organization_ids: frozenset[UUID] | None = None
    token = get_bearer_token(request)
    if token is not None and is_registration_token_prefix(token):
        return AuthSubject(Anonymous(), set(), None)

    if token is not None and token.startswith(MEMBER_SESSION_TOKEN_PREFIX):
        member_session = await get_member_session(session, token)
        if member_session is None:
            raise InvalidTokenError()
        return AuthSubject(
            member_session.member,
            {Scope.customer_portal_write},
            member_session,
        )

    if token is not None and token.startswith(CUSTOMER_SESSION_TOKEN_PREFIX):
        customer_session = await get_customer_session(session, token)
        if customer_session is None:
            raise InvalidTokenError()
        return AuthSubject(
            customer_session.customer,
            {Scope.customer_portal_write},
            customer_session,
        )

    if token is not None and token.startswith(ORGANIZATION_ACCESS_TOKEN_PREFIX):
        organization_access_token = await get_organization_access_token(session, token)
        if organization_access_token is None:
            raise InvalidTokenError()
        subject = organization_access_token.organization
        scopes = organization_access_token.scopes
        credential = organization_access_token

    elif token is not None and is_access_token_prefix(token):
        oauth2_token = await get_oauth2_token(session, token)
        if oauth2_token is None:
            raise InvalidTokenError()
        subject = oauth2_token.sub
        scopes = oauth2_token.scopes
        credential = oauth2_token
        organization_ids = oauth2_token.organization_ids

    elif token is not None and token.startswith(PERSONAL_ACCESS_TOKEN_PREFIX):
        personal_access_token = await get_personal_access_token(session, token)
        if personal_access_token is None:
            raise InvalidTokenError()
        subject = personal_access_token.user
        scopes = personal_access_token.scopes
        credential = personal_access_token
    elif token is not None:
        raise InvalidTokenError()
    else:
        user_session = await get_user_session(request, session)
        if user_session is None:
            return AuthSubject(Anonymous(), set(), None)
        subject = user_session.user
        scopes = set(user_session.scopes)
        credential = user_session
        organization_ids = (
            frozenset(
                scope.organization_id for scope in user_session.organization_scopes
            )
            or None
        )

    organization_id = get_requested_organization_id(request)
    if (
        organization_id is not None
        and isinstance(subject, Organization)
        and organization_id != subject.id
    ):
        raise RequestedOrganizationNotAccessible()

    if organization_id is not None and isinstance(subject, User):
        credential_auth_subject = AuthSubject(
            subject, scopes, credential, organization_ids
        )
        if (
            await get_accessible_organization(
                session, credential_auth_subject, organization_id
            )
            is None
        ):
            raise RequestedOrganizationNotAccessible()
        organization_ids = frozenset({organization_id})

    return AuthSubject(subject, scopes, credential, organization_ids)


def get_requested_organization_id(request: Request) -> UUID | None:
    value = request.headers.get(ORGANIZATION_HEADER)
    if value is None:
        return None
    try:
        return UUID(value)
    except ValueError as e:
        raise InvalidRequestedOrganization(
            f"The {ORGANIZATION_HEADER} header must be an organization ID."
        ) from e


class AuthSubjectMiddleware:
    def __init__(self, app: ASGIApp, redis: Redis) -> None:
        self.app = app
        self.redis = redis

    async def __call__(self, scope: ASGIScope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        session: AsyncSession = scope["state"]["async_session"]
        request = Request(scope)

        try:
            auth_subject = await get_auth_subject(request, session)
        except OAuth2Error as e:
            token = get_bearer_token(request)
            if token is not None:
                await clear_cached_identity(self.redis, token)
            response = await oauth2_error_exception_handler(request, e)
            request.state.transaction_failed = True
            return await response(scope, receive, send)
        except PolarAuthError as e:
            response = await polar_exception_handler(request, e)
            request.state.transaction_failed = True
            return await response(scope, receive, send)

        scope["state"]["auth_subject"] = auth_subject

        cookie = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
        if not isinstance(auth_subject.subject, Anonymous):
            token = get_bearer_token(request)
            if token is not None:
                await write_cached_identity(
                    self.redis, token, auth_subject.rate_limit_key
                )
            if cookie is not None:
                await write_cached_identity(
                    self.redis, cookie, auth_subject.rate_limit_key
                )
        elif cookie is not None:
            await clear_cached_identity(self.redis, cookie)

        with logfire.set_baggage(**auth_subject.log_context):
            log.info("Authenticated subject", **auth_subject.log_context)
            set_sentry_user(auth_subject)
            # Other scope types (lifespan, etc.)
            await self.app(scope, receive, send)
