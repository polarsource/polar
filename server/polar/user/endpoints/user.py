import structlog
from fastapi import Depends

from polar.auth.dependencies import Authenticator, WebUser
from polar.auth.models import AuthSubject
from polar.authz.service import Authz
from polar.exceptions import InternalServerError
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service,
)
from polar.integrations.stripe.service import stripe as stripe_service
from polar.locker import Locker, get_locker
from polar.models import User
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.organization.schemas import Organization
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter
from polar.user.service.user import user as user_service

from ..schemas.user import UserRead, UserScopes, UserSetAccount, UserStripePortalSession

log = structlog.get_logger()

router = APIRouter(include_in_schema=IN_DEVELOPMENT_ONLY)


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth_subject: WebUser) -> User:
    return auth_subject.subject


@router.get("/me/scopes", response_model=UserScopes)
async def scopes(
    auth_subject: AuthSubject[User] = Depends(Authenticator(allowed_subjects={User})),
) -> UserScopes:
    return UserScopes(scopes=list(auth_subject.scopes))


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
