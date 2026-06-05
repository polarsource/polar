import json
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, Header, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import UUID4

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.db.postgres import AsyncReadSession as AsyncReadSessionT
from polar.kit.db.postgres import AsyncSession as AsyncSessionT
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.models import SlackApp
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .auth import SlackIntegrationRead, SlackIntegrationWrite
from .manifest import generate_manifest
from .repository import SlackAppRepository
from .schemas import (
    SlackIntegration,
    SlackIntegrationCredentialsUpdate,
    SlackIntegrationManifest,
    SlackIntegrationManifestRequest,
    SlackWorkspaceUser,
    SlackWorkspaceUsersResponse,
)
from .service import (
    SlackIntegrationInvalidState,
    SlackIntegrationNotConfigured,
    slack_app_service,
)
from .verification import verify_slack_signature

router = APIRouter(
    prefix="/integrations/slack",
    tags=["integrations_slack", APITag.private],
)

CALLBACK_ROUTE_NAME = "integrations.slack.callback"


async def _get_writable_integration(
    session: AsyncSessionT | AsyncReadSessionT,
    auth_subject: AuthSubject[Any],
    integration_id: UUID,
) -> SlackApp:
    integration = await slack_app_service.get(session, integration_id)
    if integration is None:
        raise ResourceNotFound()
    await assert_organization_permission(
        session,
        auth_subject,
        integration.organization_id,
        OrganizationPermission.organization_manage,
    )
    await _assert_slack_benefit_enabled(session, integration.organization_id)
    return integration


async def _assert_slack_benefit_enabled(
    session: AsyncSessionT | AsyncReadSessionT,
    organization_id: UUID,
) -> None:
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(organization_id)
    if organization is None:
        raise ResourceNotFound()
    if not organization.feature_settings.get("slack_benefit_enabled", False):
        raise ResourceNotFound()


@router.get(
    "/integration",
    response_model=SlackIntegration,
    responses={404: {"description": "No Slack integration configured."}},
)
async def get_integration(
    auth_subject: SlackIntegrationRead,
    integration_id: Annotated[UUID4, Query()],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SlackIntegration:
    integration = await _get_writable_integration(session, auth_subject, integration_id)
    return SlackIntegration.model_validate(integration)


@router.get(
    "/users",
    response_model=SlackWorkspaceUsersResponse,
    responses={404: {"description": "No Slack integration configured."}},
)
async def list_workspace_users(
    integration_id: Annotated[UUID4, Query()],
    auth_subject: SlackIntegrationRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SlackWorkspaceUsersResponse:
    integration = await _get_writable_integration(session, auth_subject, integration_id)
    if integration.bot_token is None:
        raise ResourceNotFound()
    users = await slack_app_service.list_workspace_users(integration)
    return SlackWorkspaceUsersResponse(users=[SlackWorkspaceUser(**u) for u in users])


@router.delete(
    "/integration",
    status_code=204,
    responses={404: {"description": "No Slack integration configured."}},
)
async def delete_integration(
    integration_id: Annotated[UUID4, Query()],
    auth_subject: SlackIntegrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    integration = await _get_writable_integration(session, auth_subject, integration_id)
    await slack_app_service.delete(session, integration)


@router.post("/manifest", response_model=SlackIntegrationManifest)
async def post_manifest(
    payload: SlackIntegrationManifestRequest,
    auth_subject: SlackIntegrationWrite,
) -> SlackIntegrationManifest:
    return SlackIntegrationManifest(manifest=generate_manifest(payload.display_name))


@router.post(
    "/credentials",
    response_model=SlackIntegration,
    responses={404: {"description": "No Slack integration configured."}},
)
async def post_credentials(
    payload: SlackIntegrationCredentialsUpdate,
    auth_subject: SlackIntegrationWrite,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SlackIntegration:
    await assert_organization_permission(
        session,
        auth_subject,
        payload.organization_id,
        OrganizationPermission.organization_manage,
    )
    await _assert_slack_benefit_enabled(session, payload.organization_id)
    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    integration = await slack_app_service.set_credentials(
        session, payload.organization_id, payload, redirect_uri=redirect_uri
    )
    return SlackIntegration.model_validate(integration)


@router.get(
    "/authorize",
    responses={404: {"description": "No Slack integration configured."}},
)
async def authorize(
    integration_id: Annotated[UUID4, Query()],
    return_to: ReturnTo,
    auth_subject: SlackIntegrationWrite,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    integration = await _get_writable_integration(session, auth_subject, integration_id)
    if integration.client_id is None:
        raise SlackIntegrationNotConfigured()

    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    authorize_url = slack_app_service.build_authorize_url(
        integration,
        subject_id=auth_subject.subject.id,
        redirect_uri=redirect_uri,
        return_to=return_to,
    )
    return RedirectResponse(authorize_url, 303)


@router.get("/callback", name=CALLBACK_ROUTE_NAME)
async def callback(
    auth_subject: SlackIntegrationWrite,
    request: Request,
    code: str | None = Query(None),
    error: str | None = Query(None),
    state: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    state_data = slack_app_service.decode_state(state)

    if state_data.get("subject_id") != str(auth_subject.subject.id):
        raise SlackIntegrationInvalidState(
            "Authorization must be completed by the same account that started it."
        )

    integration_id = UUID(state_data["integration_id"])
    await _get_writable_integration(session, auth_subject, integration_id)

    return_to = state_data.get("return_to")
    if code is None or error is not None:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to or "", error=error or "Failed to authorize Slack app."
            )
        )
        return RedirectResponse(redirect_url, 303)

    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    await slack_app_service.complete_install(
        session, integration_id, code=code, redirect_uri=redirect_uri
    )

    return RedirectResponse(get_safe_return_url(return_to), 303)


@router.post(
    "/events",
    name="integrations.slack.events",
    include_in_schema=False,
)
async def events(
    request: Request,
    x_slack_signature: Annotated[str | None, Header()] = None,
    x_slack_request_timestamp: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    if x_slack_signature is None or x_slack_request_timestamp is None:
        raise Unauthorized()

    body = await request.body()
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as e:
        raise BadRequest("Invalid JSON.") from e

    api_app_id = payload.get("api_app_id")
    if not isinstance(api_app_id, str):
        raise BadRequest("Missing api_app_id.")

    repository = SlackAppRepository.from_session(session)
    integration = await repository.get_by_app_id(api_app_id)
    if integration is None or integration.signing_secret is None:
        raise Unauthorized()

    if not verify_slack_signature(
        signing_secret=integration.signing_secret,
        request_body=body,
        signature_header=x_slack_signature,
        timestamp_header=x_slack_request_timestamp,
    ):
        raise Unauthorized()

    payload_type = payload.get("type")
    if payload_type == "url_verification":
        challenge = payload.get("challenge", "")
        return JSONResponse({"challenge": challenge})

    if payload_type == "event_callback":
        event = payload.get("event") or {}
        await slack_app_service.handle_event(
            session, api_app_id=api_app_id, event=event
        )

    return JSONResponse({})
