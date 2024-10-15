from typing import Any
from uuid import UUID

import structlog
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Request,
)
from fastapi.responses import JSONResponse, RedirectResponse
from githubkit.exception import RequestFailed
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token
from pydantic import BaseModel, ValidationError

from polar.auth.dependencies import WebUser, WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import AuthService
from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.context import ExecutionContext
from polar.exceptions import (
    InternalServerError,
    NotPermitted,
    PolarRedirectionError,
    ResourceNotFound,
)
from polar.external_organization.schemas import (
    ExternalOrganization as ExternalOrganizationSchema,
)
from polar.external_organization.schemas import ExternalOrganizationID
from polar.integrations.github import client as github
from polar.kit import jwt
from polar.kit.http import ReturnTo
from polar.locker import Locker, get_locker
from polar.models import ExternalOrganization
from polar.models.benefit import BenefitType
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.redis import Redis, get_redis
from polar.reward.service import reward_service
from polar.user.schemas.user import UserSignupAttribution, UserSignupAttributionQuery
from polar.worker import enqueue_job

from . import types
from .schemas import (
    GithubUser,
    InstallationCreate,
    OAuthAccessToken,
    OrganizationBillingPlan,
    OrganizationCheckPermissionsInput,
)
from .service.organization import github_organization
from .service.secret_scanning import secret_scanning as secret_scanning_service
from .service.user import GithubUserServiceError, github_user

log = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/github",
    tags=["integrations_github"],
    include_in_schema=IN_DEVELOPMENT_ONLY,
)


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


@router.get("/authorize", name="integrations.github.authorize")
async def github_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    signup_attribution: UserSignupAttributionQuery,
    payment_intent_id: str | None = None,
) -> RedirectResponse:
    state: dict[str, Any] = {}
    if payment_intent_id:
        state["payment_intent_id"] = payment_intent_id

    state["return_to"] = return_to

    if signup_attribution:
        state["signup_attribution"] = signup_attribution.model_dump(exclude_unset=True)

    if is_user(auth_subject):
        state["user_id"] = str(auth_subject.subject.id)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="github_oauth")
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.github.callback")),
        state=encoded_state,
        scope=["user", "user:email"],
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/callback", name="integrations.github.callback")
async def github_callback(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
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

    state_signup_attribution = state_data.get("signup_attribution")
    if state_signup_attribution:
        state_signup_attribution = UserSignupAttribution.model_validate(
            state_signup_attribution
        )

    try:
        if (
            is_user(auth_subject)
            and state_user_id is not None
            and auth_subject.subject.id == UUID(state_user_id)
        ):
            is_signup = False
            user = await github_user.link_existing_user(
                session, user=auth_subject.subject, tokens=tokens
            )
        else:
            user, is_signup = await github_user.get_updated_or_create(
                session,
                locker,
                tokens=tokens,
                signup_attribution=state_signup_attribution,
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
        "benefit.precondition_fulfilled",
        user_id=user.id,
        benefit_type=BenefitType.github_repository,
    )

    # Event tracking last to ensure business critical data is stored first
    if is_signup:
        posthog.user_signup(user, "github")
    else:
        posthog.user_login(user, "github")

    return AuthService.generate_login_cookie_response(
        request=request, user=user, return_to=return_to
    )


###############################################################################
# User lookup
###############################################################################


class LookupUserRequest(BaseModel):
    username: str


@router.post("/lookup_user", response_model=GithubUser)
async def lookup_user(
    body: LookupUserRequest,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> GithubUser:
    try:
        client = await github.get_user_client(session, locker, auth_subject.subject)
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


@router.get("/organizations/{id}/installation")
async def redirect_to_organization_installation(
    id: ExternalOrganizationID,
    return_to: ReturnTo,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    external_organization = await github_organization.get(session, id)

    if external_organization is None:
        raise PolarRedirectionError("Organization not found", return_to=return_to)

    if not await authz.can(
        auth_subject.subject, AccessType.write, external_organization
    ):
        raise PolarRedirectionError(
            "You don't have access to this organization", return_to=return_to
        )

    if external_organization.installation_id is None:
        return RedirectResponse(
            f"https://github.com/apps/{settings.GITHUB_APP_NAMESPACE}"
            f"/installations/new/permissions?target_id={external_organization.external_id}"
        )

    if external_organization.is_personal:
        return RedirectResponse(
            "https://github.com/settings/installations"
            f"/{external_organization.installation_id}/permissions/update"
        )

    return RedirectResponse(
        f"https://github.com/organizations/{external_organization.name}"
        f"/settings/installations/{external_organization.installation_id}/permissions/update"
    )


@router.post("/organizations/{id}/check_permissions", status_code=204)
async def check_organization_permissions(
    id: ExternalOrganizationID,
    input: OrganizationCheckPermissionsInput,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> None:
    external_organization = await github_organization.get(session, id)

    if external_organization is None:
        raise ResourceNotFound()

    if not await authz.can(
        auth_subject.subject, AccessType.write, external_organization
    ):
        raise NotPermitted()

    if external_organization.installation_id is None:
        raise NotPermitted()

    app_client = github.get_app_client(redis)
    app_client.rest.meta.get
    try:
        await app_client.rest.apps.async_create_installation_access_token(
            external_organization.installation_id,
            data={"permissions": input.permissions},
        )
    except RequestFailed as e:
        if e.response.status_code == 422:
            raise NotPermitted() from e
        raise InternalServerError() from e


@router.get("/organizations/{id}/billing")
async def get_organization_billing_plan(
    id: ExternalOrganizationID,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    locker: Locker = Depends(get_locker),
) -> OrganizationBillingPlan:
    external_organization = await github_organization.get(session, id)

    if external_organization is None:
        raise ResourceNotFound()

    if not await authz.can(
        auth_subject.subject, AccessType.write, external_organization
    ):
        raise NotPermitted()

    plan: (
        types.PrivateUserPropPlan
        | types.PublicUserPropPlan
        | types.OrganizationFullPropPlan
        | None
    ) = None
    if external_organization.is_personal:
        user_client = await github.get_user_client(
            session, locker, auth_subject.subject
        )
        user_response = await user_client.rest.users.async_get_authenticated()
        plan = user_response.parsed_data.plan
    else:
        if external_organization.installation_id is None:
            raise ResourceNotFound()

        org_client = github.get_app_installation_client(
            external_organization.installation_id, redis=redis
        )
        org_response = await org_client.rest.orgs.async_get(external_organization.name)
        plan = org_response.parsed_data.plan

    if not plan:
        raise NotPermittedOrganizationBillingPlan()

    plan_name = plan.name

    return OrganizationBillingPlan(
        organization_id=external_organization.id,
        plan_name=plan_name,
        is_free=plan_name.lower() == "free",
    )


###############################################################################
# INSTALLATIONS
###############################################################################


@router.post("/installations", response_model=ExternalOrganizationSchema)
async def install(
    installation_create: InstallationCreate,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
    redis: Redis = Depends(get_redis),
) -> ExternalOrganization:
    with ExecutionContext(is_during_installation=True):
        external_organization = await github_organization.install(
            session, redis, locker, authz, auth_subject.subject, installation_create
        )

        posthog.auth_subject_event(
            auth_subject,
            "organizations",
            "github_install",
            "submit",
            {
                "organization_id": external_organization.organization_id,
                "external_organization_id": external_organization.id,
            },
        )

        return external_organization


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


@router.post("/secret-scanning", include_in_schema=False)
async def secret_scanning(
    request: Request,
    github_public_key_identifier: str = Header(),
    github_public_key_signature: str = Header(),
    session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    payload = (await request.body()).decode()
    await secret_scanning_service.verify_signature(
        payload, github_public_key_signature, github_public_key_identifier
    )

    data = secret_scanning_service.validate_payload(payload)

    response_data = await secret_scanning_service.handle_alert(session, data)
    return JSONResponse(content=response_data)
