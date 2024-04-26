import structlog
from fastapi import APIRouter, Depends, Response

from polar.auth.dependencies import Authenticator, WebUser
from polar.auth.models import AuthSubject
from polar.auth.service import AuthService, LogoutResponse
from polar.authz.service import Authz
from polar.exceptions import InternalServerError
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service,
)
from polar.integrations.stripe.service import stripe as stripe_service
from polar.locker import Locker, get_locker
from polar.models import User
from polar.organization.schemas import Organization
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.user.service import user as user_service

from .schemas import (
    UserRead,
    UserScopes,
    UserSetAccount,
    UserStripePortalSession,
    UserUpdateSettings,
)

log = structlog.get_logger()

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth_subject: WebUser) -> User:
    return auth_subject.subject


@router.get("/me/scopes", response_model=UserScopes)
async def scopes(
    auth_subject: AuthSubject[User] = Depends(Authenticator(allowed_subjects={User})),
) -> UserScopes:
    return UserScopes(scopes=list(auth_subject.scopes))


@router.put("/me", response_model=UserRead)
async def update_preferences(
    settings: UserUpdateSettings,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    return await user_service.update_preferences(
        session, auth_subject.subject, settings
    )


@router.post("/me/upgrade", response_model=Organization)
async def maintainer_upgrade(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Organization:
    user = auth_subject.subject
    log.info("user.maintainer_upgrade", user_id=user.id)
    personal_org = await github_organization_service.create_for_user(
        session, locker, user=user
    )
    posthog.auth_subject_event(auth_subject, "user", "maintainer_upgrade", "submit")

    log.info("user.maintainer_upgrade", user_id=user.id, new_org_id=personal_org.id)
    return Organization.from_db(personal_org)


@router.patch("/me/account", response_model=UserRead)
async def set_account(
    set_account: UserSetAccount,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    return await user_service.set_account(
        session,
        authz=authz,
        user=auth_subject.subject,
        account_id=set_account.account_id,
    )


@router.get(
    "/logout",
    deprecated=True,  # Use /api/v1/auth/logout instead, which also has support for custom domains
)
async def logout(response: Response, auth_subject: WebUser) -> LogoutResponse:
    return AuthService.generate_logout_response(response=response)


@router.post(
    "/me/stripe_customer_portal",
    response_model=UserStripePortalSession,
)
async def create_stripe_customer_portal(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> UserStripePortalSession:
    portal = await stripe_service.create_user_portal_session(
        session, auth_subject.subject
    )
    if not portal:
        raise InternalServerError()

    return UserStripePortalSession(url=portal.url)
