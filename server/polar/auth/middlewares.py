import uuid

import logfire
import structlog
from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param
from starlette.types import ASGIApp, Receive, Send
from starlette.types import Scope as ASGIScope

from polar.config import settings
from polar.customer_session.service import customer_session as customer_session_service
from polar.kit import jwt
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    CustomerSession,
    OAuth2Token,
    Organization,
    OrganizationAccessToken,
    PersonalAccessToken,
    User,
    UserSession,
)
from polar.oauth2.exception_handlers import OAuth2Error, oauth2_error_exception_handler
from polar.oauth2.exceptions import InvalidTokenError
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.personal_access_token.service import (
    personal_access_token as personal_access_token_service,
)
from polar.postgres import AsyncSession
from polar.sentry import set_sentry_user
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker._enqueue import enqueue_job

from .models import Anonymous, AuthSubject, JWTSession, Subject
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


async def validate_jwt_token(
    session: AsyncSession, token: str
) -> tuple[User, Organization] | None:
    """
    Validate a JWT token and return the user and organization.

    The JWT should contain:
    - user_id: UUID of the user
    - organization_id: UUID of the organization

    This validates:
    1. JWT signature is valid
    2. User is a member of the organization (validates both user and org exist)
    3. User is not blocked
    """
    try:
        log.info("Validating JWT token", token_prefix=token[:20] + "...")
        # Decode and validate JWT
        payload = jwt.decode_unsafe(token=token, secret=settings.SECRET)
        log.info("JWT decoded", payload=payload)

        # Extract user_id and organization_id
        user_id_str = payload.get("user_id")
        organization_id_str = payload.get("organization_id")

        if not user_id_str or not organization_id_str:
            log.debug("JWT missing required fields", payload=payload)
            return None

        user_id = uuid.UUID(user_id_str)
        organization_id = uuid.UUID(organization_id_str)

        user_org = await user_organization_service.get_by_user_and_org(
            session, user_id, organization_id
        )

        if not user_org:
            log.warning(
                "User not member of organization or not found",
                user_id=user_id,
                organization_id=organization_id,
            )
            return None

        # Additional check: ensure user is not blocked
        if user_org.user.blocked_at is not None:
            log.warning("User is blocked", user_id=user_id)
            return None

        return user_org.user, user_org.organization

    except (jwt.DecodeError, jwt.ExpiredSignatureError, ValueError) as e:
        log.debug("JWT validation failed", error=str(e))
        return None


def looks_like_jwt(token: str) -> bool:
    """Check if a token looks like a JWT (has 3 parts separated by dots)."""
    parts = token.split(".")
    return len(parts) == 3


async def get_auth_subject(
    request: Request, session: AsyncSession
) -> AuthSubject[Subject]:
    token = get_bearer_token(request)
    if token is not None:
        customer_session = await get_customer_session(session, token)
        if customer_session:
            return AuthSubject(
                customer_session.customer,
                {Scope.customer_portal_write},
                customer_session,
            )

        # Try to validate as JWT token if it looks like one
        if looks_like_jwt(token):
            jwt_result = await validate_jwt_token(session, token)
            if jwt_result:
                user, organization = jwt_result
                # JWT tokens act as organization tokens - use organization as subject
                # This makes all existing is_organization() checks work automatically
                # Store user info in JWTSession for audit/logging purposes
                jwt_session = JWTSession(organization)
                jwt_session.user = user
                return AuthSubject(
                    organization,
                    {Scope.web_write, Scope.web_read},
                    jwt_session,
                )

        organization_access_token = await get_organization_access_token(session, token)
        if organization_access_token:
            return AuthSubject(
                organization_access_token.organization,
                organization_access_token.scopes,
                organization_access_token,
            )

        oauth2_token = await get_oauth2_token(session, token)
        if oauth2_token:
            return AuthSubject(oauth2_token.sub, oauth2_token.scopes, oauth2_token)

        personal_access_token = await get_personal_access_token(session, token)
        if personal_access_token:
            return AuthSubject(
                personal_access_token.user,
                personal_access_token.scopes,
                personal_access_token,
            )

        raise InvalidTokenError()

    user_session = await get_user_session(request, session)
    if user_session is not None:
        return AuthSubject(user_session.user, set(user_session.scopes), user_session)

    return AuthSubject(Anonymous(), set(), None)


class AuthSubjectMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: ASGIScope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        session: AsyncSession = scope["state"]["async_session"]
        request = Request(scope)

        try:
            auth_subject = await get_auth_subject(request, session)
        except OAuth2Error as e:
            response = await oauth2_error_exception_handler(request, e)
            return await response(scope, receive, send)

        scope["state"]["auth_subject"] = auth_subject

        with logfire.set_baggage(**auth_subject.log_context):
            log.info("Authenticated subject", **auth_subject.log_context)
            set_sentry_user(auth_subject)
            await self.app(scope, receive, send)
