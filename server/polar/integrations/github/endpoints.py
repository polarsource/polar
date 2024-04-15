from typing import Literal
from uuid import UUID

import structlog
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import RedirectResponse
from githubkit.exception import RequestFailed
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token
from pydantic import UUID4, BaseModel, ValidationError

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.auth.service import AuthService
from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.context import ExecutionContext
from polar.enums import UserSignupType
from polar.exceptions import (
    InternalServerError,
    NotPermitted,
    PolarRedirectionError,
    ResourceNotFound,
    Unauthorized,
)
from polar.integrations.github import client as github
from polar.kit import jwt
from polar.kit.http import ReturnTo
from polar.locker import Locker, get_locker
from polar.models.benefit import BenefitType
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.reward.service import reward_service
from polar.tags.api import Tags
from polar.worker import enqueue_job

from .schemas import (
    GithubUser,
    OAuthAccessToken,
    OrganizationBillingPlan,
    OrganizationCheckPermissionsInput,
)
from .service.members import github_members_service
from .service.organization import github_organization
from .service.user import GithubUserServiceError, github_user

log = structlog.get_logger()

router = APIRouter(prefix="/integrations/github", tags=["integrations_github"])


###############################################################################
# LOGIN
###############################################################################

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)
oauth2_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client, route_name="integrations.github.callback"
)


class OAuthCallbackError(PolarRedirectionError): ...


class NotPermittedOrganizationBillingPlan(NotPermitted):
    def __init__(self) -> None:
        message = "Organization billing plan not accessible."
        super().__init__(message)


@router.get("/authorize", name="integrations.github.authorize", tags=[Tags.INTERNAL])
async def github_authorize(
    request: Request,
    return_to: ReturnTo,
    payment_intent_id: str | None = None,
    user_signup_type: UserSignupType | None = None,
    auth: Auth = Depends(Auth.optional_user),
) -> RedirectResponse:
    state = {}
    if payment_intent_id:
        state["payment_intent_id"] = payment_intent_id

    state["return_to"] = return_to

    if user_signup_type:
        state["user_signup_type"] = user_signup_type

    if auth.user is not None:
        state["user_id"] = str(auth.user.id)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="github_oauth")
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.github.callback")),
        state=encoded_state,
        scope=["user", "user:email"],
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/callback", name="integrations.github.callback", tags=[Tags.INTERNAL])
async def github_callback(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
    auth: Auth = Depends(Auth.optional_user),
    locker: Locker = Depends(get_locker),
) -> RedirectResponse:
    token_data, state = access_token_state
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)
    if not state:
        raise OAuthCallbackError("No state")

    try:
        state_data = jwt.decode(
            token=state, secret=settings.SECRET, type="github_oauth"
        )
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e

    return_to = state_data.get("return_to", None)

    try:
        tokens = OAuthAccessToken(**token_data)
    except ValidationError as e:
        raise OAuthCallbackError("Invalid token data", return_to=return_to) from e

    state_user_id = state_data.get("user_id")
    state_user_type = UserSignupType.backer
    if state_data.get("user_signup_type") == UserSignupType.maintainer:
        state_user_type = UserSignupType.maintainer

    try:
        if (
            auth.user is not None
            and state_user_id is not None
            and auth.user.id == UUID(state_user_id)
        ):
            user = await github_user.link_existing_user(
                session, user=auth.user, tokens=tokens
            )
        else:
            user = await github_user.login_or_signup(
                session, locker, tokens=tokens, signup_type=state_user_type
            )

    except GithubUserServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    payment_intent_id = state_data.get("payment_intent_id")
    if payment_intent_id:
        await pledge_service.connect_backer(
            session, payment_intent_id=payment_intent_id, backer=user
        )

    # connect dangling rewards
    await reward_service.connect_by_username(session, user)

    # Make sure potential GitHub benefits are granted
    enqueue_job(
        "subscription.subscription_benefit.precondition_fulfilled",
        user_id=user.id,
        benefit_type=BenefitType.github_repository,
    )

    posthog.identify(user)
    posthog.user_event(user, "user", "github_oauth_login", "done")

    return AuthService.generate_login_cookie_response(
        request=request, user=user, return_to=return_to
    )


###############################################################################
# User lookup
###############################################################################


class SynchronizeMembersResponse(BaseModel):
    status: bool


@router.post("/synchronize_members", response_model=SynchronizeMembersResponse)
async def synchronize_members(
    organization_id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> SynchronizeMembersResponse:
    org = await github_organization.get(session, organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, org):
        raise Unauthorized()

    await github_members_service.synchronize_members(session, org)

    return SynchronizeMembersResponse(status=True)


class LookupUserRequest(BaseModel):
    username: str


@router.post("/lookup_user", response_model=GithubUser)
async def lookup_user(
    body: LookupUserRequest,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> GithubUser:
    try:
        client = await github.get_user_client(session, locker, auth.user)
        github_user = await client.rest.users.async_get_by_username(
            username=body.username
        )
    except Exception:
        raise HTTPException(status_code=404, detail="user not found")

    return GithubUser(
        username=github_user.parsed_data.login,
        avatar_url=github_user.parsed_data.avatar_url,
    )


###############################################################################
# Organization
###############################################################################


@router.get("/organizations/{id}/installation", tags=[Tags.INTERNAL])
async def redirect_to_organization_installation(
    id: UUID4,
    return_to: ReturnTo,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    organization = await github_organization.get(session, id)

    if organization is None:
        raise PolarRedirectionError("Organization not found", return_to=return_to)

    if not await authz.can(auth.user, AccessType.write, organization):
        raise PolarRedirectionError(
            "You don't have access to this organization", return_to=return_to
        )

    if organization.installation_id is None:
        return RedirectResponse(
            f"https://github.com/apps/{settings.GITHUB_APP_NAMESPACE}"
            f"/installations/new/permissions?target_id={organization.external_id}"
        )

    if organization.is_personal:
        return RedirectResponse(
            "https://github.com/settings/installations"
            f"/{organization.installation_id}/permissions/update"
        )

    return RedirectResponse(
        f"https://github.com/organizations/{organization.name}"
        f"/settings/installations/{organization.installation_id}/permissions/update"
    )


@router.post(
    "/organizations/{id}/check_permissions", status_code=204, tags=[Tags.INTERNAL]
)
async def check_organization_permissions(
    id: UUID4,
    input: OrganizationCheckPermissionsInput,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    organization = await github_organization.get(session, id)

    if organization is None:
        raise ResourceNotFound()

    if not await authz.can(auth.user, AccessType.write, organization):
        raise NotPermitted()

    if organization.installation_id is None:
        raise NotPermitted()

    app_client = github.get_app_client()
    try:
        await app_client.rest.apps.async_create_installation_access_token(
            organization.installation_id, data={"permissions": input.permissions}
        )
    except RequestFailed as e:
        if e.response.status_code == 422:
            raise NotPermitted() from e
        raise InternalServerError() from e


@router.get("/organizations/{id}/billing", tags=[Tags.INTERNAL])
async def get_organization_billing_plan(
    id: UUID4,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> OrganizationBillingPlan:
    organization = await github_organization.get(session, id)

    if organization is None:
        raise ResourceNotFound()

    if not await authz.can(auth.user, AccessType.write, organization):
        raise NotPermitted()

    if organization.is_personal:
        user_client = await github.get_user_client(session, locker, auth.user)
        user_response = await user_client.rest.users.async_get_authenticated()
        plan = user_response.parsed_data.plan
    else:
        if organization.installation_id is None:
            raise ResourceNotFound()

        org_client = github.get_app_installation_client(organization.installation_id)
        org_response = await org_client.rest.orgs.async_get(organization.name)
        plan = org_response.parsed_data.plan

    if not plan:
        raise NotPermittedOrganizationBillingPlan()

    plan_name = plan.name

    return OrganizationBillingPlan(
        organization_id=organization.id,
        plan_name=plan_name,
        is_free=plan_name.lower() == "free",
    )


###############################################################################
# INSTALLATIONS
###############################################################################


class InstallationCreate(BaseModel):
    platform: Literal["github"]
    external_id: int


@router.post("/installations", response_model=OrganizationSchema)
async def install(
    installation: InstallationCreate,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> OrganizationSchema:
    with ExecutionContext(is_during_installation=True):
        organization = await github_organization.install_from_user_browser(
            session, locker, auth.user, installation_id=installation.external_id
        )
        if not organization:
            raise ResourceNotFound()

        posthog.user_event(
            auth.user,
            "organizations",
            "github_install",
            "submit",
            {"organization_id": organization.id},
        )

        return OrganizationSchema.from_db(organization)


###############################################################################
# WEBHOOK
###############################################################################


class WebhookResponse(BaseModel):
    success: bool
    message: str | None = None
    job_id: str | None = None


IMPLEMENTED_WEBHOOKS = {
    "installation.created",
    "installation.new_permissions_accepted",
    "installation.deleted",
    "installation.suspend",
    "installation.unsuspend",
    "installation_repositories.added",
    "installation_repositories.removed",
    "issues.opened",
    "issues.edited",
    "issues.closed",
    "issues.deleted",
    "issues.transferred",
    "issues.reopened",
    "issues.labeled",
    "issues.unlabeled",
    "issues.assigned",
    "issues.unassigned",
    "pull_request.opened",
    "pull_request.edited",
    "pull_request.closed",
    "pull_request.reopened",
    "pull_request.synchronize",
    "public",
    "repository.renamed",
    "repository.deleted",
    "repository.edited",
    "repository.archived",
    "repository.transferred",
    "organization.renamed",
    "organization.member_added",
    "organization.member_removed",
}


def not_implemented() -> WebhookResponse:
    return WebhookResponse(success=False, message="Not implemented")


async def enqueue(request: Request) -> WebhookResponse:
    json_body = await request.json()
    event_scope = request.headers["X-GitHub-Event"]
    event_action = json_body["action"] if "action" in json_body else None
    event_name = f"{event_scope}.{event_action}" if event_action else event_scope

    if event_name not in IMPLEMENTED_WEBHOOKS:
        return not_implemented()

    task_name = f"github.webhook.{event_name}"
    enqueue_job(task_name, event_scope, event_action, json_body)

    log.info("github.webhook.queued", task_name=task_name)
    return WebhookResponse(success=True)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(request: Request) -> WebhookResponse:
    valid_signature = github.webhooks.verify(
        settings.GITHUB_APP_WEBHOOK_SECRET,
        await request.body(),
        request.headers["X-Hub-Signature-256"],
    )
    if valid_signature:
        return await enqueue(request)

    # Should be 403 Forbidden, but...
    # Throwing unsophisticated hackers/scrapers/bots off the scent
    raise HTTPException(status_code=404)
