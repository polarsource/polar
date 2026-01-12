import logfire
import structlog
from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param
from starlette.types import ASGIApp, Receive, Send
from starlette.types import Scope as ASGIScope

from polar.customer_session.service import (
    CUSTOMER_SESSION_TOKEN_PREFIX,
)
from polar.customer_session.service import (
    customer_session as customer_session_service,
)
from polar.kit.crypto import validate_token_checksum
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    CustomerSession,
    OAuth2Token,
    OrganizationAccessToken,
    PersonalAccessToken,
    UserSession,
)
from polar.oauth2.constants import ACCESS_TOKEN_PREFIX, is_registration_token_prefix
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
from polar.sentry import set_sentry_user
from polar.worker._enqueue import enqueue_job

from .models import Anonymous, AuthSubject, Subject
from .scope import Scope
from .service import auth as auth_service

log: Logger = structlog.get_logger(__name__)


def _has_valid_oauth2_token_checksum(token: str) -> bool:
    for prefix in ACCESS_TOKEN_PREFIX.values():
        if validate_token_checksum(token, prefix=prefix):
            return True
    return False


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


def _get_token_prefix(token: str) -> str | None:
    """Return the prefix if the token matches a known token type."""
    if token.startswith(CUSTOMER_SESSION_TOKEN_PREFIX):
        return CUSTOMER_SESSION_TOKEN_PREFIX
    if token.startswith(ORGANIZATION_ACCESS_TOKEN_PREFIX):
        return ORGANIZATION_ACCESS_TOKEN_PREFIX
    if token.startswith(PERSONAL_ACCESS_TOKEN_PREFIX):
        return PERSONAL_ACCESS_TOKEN_PREFIX
    for prefix in ACCESS_TOKEN_PREFIX.values():
        if token.startswith(prefix):
            return prefix
    return None


def _log_checksum_mismatch(token_type: str, prefix: str, token_length: int) -> None:
    """Log an error when a valid token has an invalid checksum."""
    log.error(
        "Valid token has invalid checksum",
        token_type=token_type,
        token_prefix=prefix,
        token_length=token_length,
    )


async def get_auth_subject(
    request: Request, session: AsyncSession
) -> AuthSubject[Subject]:
    token = get_bearer_token(request)
    if token is not None:
        if is_registration_token_prefix(token):
            return AuthSubject(Anonymous(), set(), None)

        customer_session = await get_customer_session(session, token)
        if customer_session:
            if not validate_token_checksum(token, prefix=CUSTOMER_SESSION_TOKEN_PREFIX):
                _log_checksum_mismatch(
                    "customer_session", CUSTOMER_SESSION_TOKEN_PREFIX, len(token)
                )
            return AuthSubject(
                customer_session.customer,
                {Scope.customer_portal_write},
                customer_session,
            )

        organization_access_token = await get_organization_access_token(session, token)
        if organization_access_token:
            if not validate_token_checksum(
                token, prefix=ORGANIZATION_ACCESS_TOKEN_PREFIX
            ):
                _log_checksum_mismatch(
                    "organization_access_token",
                    ORGANIZATION_ACCESS_TOKEN_PREFIX,
                    len(token),
                )
            return AuthSubject(
                organization_access_token.organization,
                organization_access_token.scopes,
                organization_access_token,
            )

        oauth2_token = await get_oauth2_token(session, token)
        if oauth2_token:
            if not _has_valid_oauth2_token_checksum(token):
                prefix = _get_token_prefix(token)
                _log_checksum_mismatch("oauth2_token", prefix or "unknown", len(token))
            return AuthSubject(oauth2_token.sub, oauth2_token.scopes, oauth2_token)

        personal_access_token = await get_personal_access_token(session, token)
        if personal_access_token:
            if not validate_token_checksum(token, prefix=PERSONAL_ACCESS_TOKEN_PREFIX):
                _log_checksum_mismatch(
                    "personal_access_token", PERSONAL_ACCESS_TOKEN_PREFIX, len(token)
                )
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
