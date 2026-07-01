import secrets
import typing
from uuid import UUID

from fastapi import Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from reauth.authentication_session import (
    AuthenticationSession,
    FactorsRemainingException,
    IdentityNotAttachedException,
)
from reauth.factors import FactorBase
from reauth.factors.oauth2.base import (
    OAuth2CallbackException,
    OAuth2GetProfileException,
    OAuth2TokenException,
)
from reauth.factors.oauth2.oidc import OIDCException, OIDCFactorBase
from reauth.factors.oauth2.state import ExpiredStateException, InvalidStateException

from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.models import Organization, OrganizationSSOConnection
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.sso.repository import OrganizationSSOConnectionRepository
from polar.user.repository import UserRepository
from polar.user_organization.repository import UserOrganizationRepository

from ..authentication_session import (
    AuthenticationSessionService,
    get_authentication_session,
    get_org_authentication_session_service,
)
from ..exceptions import PolarAuthRedirectionError
from ..factors import get_org_factors
from ..helpers import OIDC_ERROR_MESSAGE, check_factor, set_state_cookie
from ..oauth2.state import OAuth2StateService, get_oauth2_state_service
from ..schemas import AuthenticationSession as AuthenticationSessionSchema
from ..schemas import AuthenticationSessionStart
from ..service import auth as auth_service

SSO_SCOPE = ["openid", "email"]


async def get_sso_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSSOConnection:
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_slug(slug)
    if organization is None:
        raise ResourceNotFound()

    sso_repository = OrganizationSSOConnectionRepository.from_session(session)
    connection = await sso_repository.get_enabled_by_organization_and_id(
        organization.id, connection_id
    )
    if connection is None:
        raise ResourceNotFound()
    return connection


async def get_sso_factor(
    connection: OrganizationSSOConnection = Depends(get_sso_connection),
    factors: set[FactorBase[typing.Any]] = Depends(get_org_factors),
) -> OIDCFactorBase:
    for factor in factors:
        if isinstance(factor, OIDCFactorBase) and factor.identifier == str(
            connection.id
        ):
            return factor
    raise ResourceNotFound()


async def get_login_organization(
    slug: str,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    organization = await OrganizationRepository.from_session(session).get_by_slug(slug)
    if organization is None:
        raise ResourceNotFound()
    return organization


async def get_org_authentication_session(
    organization: Organization = Depends(get_login_organization),
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
) -> AuthenticationSession:
    """The authentication session, verified to belong to the URL's organization.

    A session is bound to its organization at `/{slug}/start`; this rejects a
    session that is then driven to a different organization's endpoints.
    """
    context = authentication_session.context or {}
    if context.get("organization_id") != str(organization.id):
        raise PolarAuthRedirectionError(
            "This authentication session was not started for this organization"
        )
    return authentication_session


router = APIRouter(prefix="/{slug}")


@router.post(
    "/start",
    name="auth.sso.start",
    status_code=201,
    tags=[APITag.private],
    responses={
        404: {
            "description": "Organization not found",
            "model": ResourceNotFound.schema(),
        }
    },
)
async def start(
    request: Request,
    response: Response,
    authentication_session_start: AuthenticationSessionStart,
    organization: Organization = Depends(get_login_organization),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_org_authentication_session_service
    ),
) -> AuthenticationSessionSchema:
    token, authentication_session = await authentication_session_service.start(
        return_to=authentication_session_start.return_to
    )
    # Bind the session to this organization; slug-scoped endpoints verify it.
    authentication_session.context = {
        **(authentication_session.context or {}),
        "organization_id": str(organization.id),
    }
    await authentication_session_service.update(authentication_session)
    await authentication_session_service.set_cookie(
        request, response, token, authentication_session.expires_at
    )
    return await authentication_session_service.to_schema(authentication_session)


@router.get(
    "/sso/{connection_id}/authorize",
    name="auth.sso.authorize",
    include_in_schema=False,
)
async def authorize(
    request: Request,
    slug: str,
    connection_id: UUID,
    authentication_session: AuthenticationSession = Depends(
        get_org_authentication_session
    ),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_org_authentication_session_service
    ),
    factor: OIDCFactorBase = Depends(get_sso_factor),
) -> RedirectResponse:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    check_factor(factor, factors)

    redirect_uri = str(request.url_for("auth.sso.callback", slug=slug))
    try:
        authorization_url, state, oauth2_state = await factor.start(
            redirect_uri=redirect_uri,
            scope=SSO_SCOPE,
            nonce=secrets.token_urlsafe(16),
            authentication_session_token_hash=authentication_session.token_hash,
            sso_connection_id=str(connection_id),
        )
    except OIDCException as e:
        raise PolarAuthRedirectionError(OIDC_ERROR_MESSAGE) from e

    response = RedirectResponse(authorization_url, status_code=303)
    set_state_cookie(request, response, state, oauth2_state.expires_at)
    return response


@router.get("/sso/callback", name="auth.sso.callback", include_in_schema=False)
async def callback(
    request: Request,
    slug: str,
    code: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    error_uri: str | None = Query(None),
    state: str | None = Query(None),
    authentication_session: AuthenticationSession = Depends(
        get_org_authentication_session
    ),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_org_authentication_session_service
    ),
    factors: set[FactorBase[typing.Any]] = Depends(get_org_factors),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if state is None:
        raise PolarAuthRedirectionError("Missing OAuth2 state")

    state_cookie = request.cookies.get(settings.OAUTH2_SESSION_STATE_COOKIE_KEY)
    if state_cookie is None:
        raise PolarAuthRedirectionError("Missing OAuth2 state cookie")
    if state != state_cookie:
        raise PolarAuthRedirectionError("Invalid OAuth2 state")

    oauth2_state = await state_service.get_by_token(state)
    if oauth2_state is None or oauth2_state.context is None:
        raise PolarAuthRedirectionError("Invalid OAuth2 state")
    connection_id = oauth2_state.context.get("sso_connection_id")
    if connection_id is None:
        raise PolarAuthRedirectionError("Invalid OAuth2 state")

    connection = await get_sso_connection(slug, UUID(connection_id), session)
    factor = await get_sso_factor(connection, factors)

    try:
        _, oauth_account, _ = await factor.callback(
            code=code,
            state=state,
            error=error,
            error_description=error_description,
            error_uri=error_uri,
        )
    except (ExpiredStateException, InvalidStateException) as e:
        raise PolarAuthRedirectionError("OAuth2 session expired") from e
    except OAuth2CallbackException as e:
        raise PolarAuthRedirectionError(e.message or "OAuth2 callback error") from e
    except (OAuth2TokenException, OAuth2GetProfileException) as e:
        raise PolarAuthRedirectionError("OAuth2 error") from e
    except OIDCException as e:
        raise PolarAuthRedirectionError(OIDC_ERROR_MESSAGE) from e

    if oauth_account is None or oauth_account.id_token is None:
        raise PolarAuthRedirectionError(OIDC_ERROR_MESSAGE)

    claims = await factor.get_id_token_claims(oauth_account.id_token)
    if claims.get("email_verified") is not True:
        raise PolarAuthRedirectionError("The email address could not be verified")

    email = claims.get("email")
    if email is None:
        raise PolarAuthRedirectionError("The identity provider did not assert an email")

    user_repository = UserRepository.from_session(session)
    user = await user_repository.get_by_email(email)
    if user is None:
        raise PolarAuthRedirectionError("No Polar account matches this identity")

    user_organization_repository = UserOrganizationRepository.from_session(session)
    membership = await user_organization_repository.get_by_user_and_organization(
        user.id, connection.organization_id
    )
    if membership is None:
        raise PolarAuthRedirectionError("You are not a member of this organization")

    await authentication_session_service.advance(
        authentication_session, user.id, factor
    )

    # Like the social login flow, hand off to the frontend so any remaining
    # factors (e.g. TOTP) are challenged before the session completes
    response = RedirectResponse(
        settings.generate_frontend_url("/auth"), status_code=303
    )
    set_state_cookie(request, response, "", 0)
    return response


@router.get("/complete", name="auth.sso.complete", include_in_schema=False)
async def complete(
    request: Request,
    organization: Organization = Depends(get_login_organization),
    authentication_session: AuthenticationSession = Depends(
        get_org_authentication_session
    ),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_org_authentication_session_service
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    try:
        identity_id, _ = await authentication_session_service.complete(
            authentication_session
        )
    except (IdentityNotAttachedException, FactorsRemainingException) as e:
        raise PolarAuthRedirectionError(
            "Authentication session cannot be completed"
        ) from e

    user_repository = UserRepository.from_session(session)
    user = await user_repository.get_by_id(identity_id)
    if user is None:
        raise PolarAuthRedirectionError("User not found for authenticated identity")

    user_organization_repository = UserOrganizationRepository.from_session(session)
    membership = await user_organization_repository.get_by_user_and_organization(
        user.id, organization.id
    )
    if membership is None:
        raise PolarAuthRedirectionError("You are not a member of this organization")

    context = authentication_session.context or {}
    response = await auth_service.get_login_response(
        session,
        request,
        user,
        return_to=context.get("return_to"),
        factor="sso",
        organization_ids=frozenset({organization.id}),
    )
    await authentication_session_service.set_cookie(request, response, "", 0)
    return response
