import json
from typing import Annotated, Any

from fastapi import Depends, Header, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import UUID4

from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.http import ReturnTo, get_safe_return_url
from polar.models import OrganizationSlackIntegration
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.organization.resolver import get_payload_organization
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .auth import SlackIntegrationRead, SlackIntegrationWrite
from .manifest import generate_manifest
from .repository import OrganizationSlackIntegrationRepository
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
    organization_slack_integration,
)
from .verification import verify_slack_signature

router = APIRouter(
    prefix="/integrations/slack",
    tags=["integrations_slack", APITag.private],
)

CALLBACK_ROUTE_NAME = "integrations.slack.callback"


def _to_read_schema(integration: OrganizationSlackIntegration) -> SlackIntegration:
    def _last_4(value: str | None) -> str:
        return value[-4:] if value else ""

    return SlackIntegration(
        id=integration.id,
        created_at=integration.created_at,
        modified_at=integration.modified_at,
        organization_id=integration.organization_id,
        display_name=integration.display_name,
        slack_app_id=integration.slack_app_id or "",
        client_id=integration.client_id or "",
        client_id_last_4=_last_4(integration.client_id),
        client_secret_last_4=_last_4(integration.client_secret),
        signing_secret_last_4=_last_4(integration.signing_secret),
        team_id=integration.team_id,
        team_name=integration.team_name,
        bot_user_id=integration.bot_user_id,
        authed_user_id=integration.authed_user_id,
        scopes=integration.scopes,
        installed_at=integration.installed_at,
        revoked_at=integration.revoked_at,
    )


@router.get(
    "/integration",
    response_model=SlackIntegration,
    responses={404: {"description": "No Slack integration configured."}},
)
async def get_integration(
    organization_id: Annotated[UUID4, Query()],
    auth_subject: SlackIntegrationRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SlackIntegration:
    await assert_organization_permission(
        session,
        auth_subject,
        organization_id,
        OrganizationPermission.organization_manage,
    )
    integration = await organization_slack_integration.get(session, organization_id)
    if integration is None:
        raise ResourceNotFound()
    return _to_read_schema(integration)


@router.get(
    "/users",
    response_model=SlackWorkspaceUsersResponse,
    responses={404: {"description": "No Slack integration configured."}},
)
async def list_workspace_users(
    organization_id: Annotated[UUID4, Query()],
    auth_subject: SlackIntegrationRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SlackWorkspaceUsersResponse:
    await assert_organization_permission(
        session,
        auth_subject,
        organization_id,
        OrganizationPermission.organization_manage,
    )
    integration = await organization_slack_integration.get(session, organization_id)
    if integration is None or integration.bot_token is None:
        raise ResourceNotFound()
    users = await organization_slack_integration.list_workspace_users(integration)
    return SlackWorkspaceUsersResponse(
        users=[SlackWorkspaceUser(**u) for u in users]
    )


@router.delete(
    "/integration",
    status_code=204,
    responses={404: {"description": "No Slack integration configured."}},
)
async def delete_integration(
    organization_id: Annotated[UUID4, Query()],
    auth_subject: SlackIntegrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await assert_organization_permission(
        session,
        auth_subject,
        organization_id,
        OrganizationPermission.organization_manage,
    )
    integration = await organization_slack_integration.get(session, organization_id)
    if integration is None:
        raise ResourceNotFound()
    await organization_slack_integration.delete(session, integration)


@router.post("/manifest", response_model=SlackIntegrationManifest)
async def post_manifest(
    payload: SlackIntegrationManifestRequest,
    auth_subject: SlackIntegrationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SlackIntegrationManifest:
    organization = await get_payload_organization(session, auth_subject, payload)
    await assert_organization_permission(
        session,
        auth_subject,
        organization.id,
        OrganizationPermission.organization_manage,
    )
    # Upsert so the field the merchant types into doubles as a save and
    # survives reloads even before they've pasted credentials.
    await organization_slack_integration.upsert_display_name(
        session, organization, payload.display_name
    )
    return SlackIntegrationManifest(manifest=generate_manifest(payload.display_name))


@router.post("/credentials", response_model=SlackIntegration)
async def post_credentials(
    payload: SlackIntegrationCredentialsUpdate,
    auth_subject: SlackIntegrationWrite,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> SlackIntegration:
    organization = await get_payload_organization(session, auth_subject, payload)
    await assert_organization_permission(
        session,
        auth_subject,
        organization.id,
        OrganizationPermission.organization_manage,
    )
    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    integration = await organization_slack_integration.set_credentials(
        session, organization, payload, redirect_uri=redirect_uri
    )
    return _to_read_schema(integration)


@router.get("/authorize")
async def authorize(
    organization_id: Annotated[UUID4, Query()],
    return_to: ReturnTo,
    auth_subject: SlackIntegrationWrite,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    await assert_organization_permission(
        session,
        auth_subject,
        organization_id,
        OrganizationPermission.organization_manage,
    )
    integration = await organization_slack_integration.get(session, organization_id)
    if integration is None or integration.client_id is None:
        raise SlackIntegrationNotConfigured()

    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    authorize_url = organization_slack_integration.build_authorize_url(
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
    code: str = Query(...),
    state: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    state_data = organization_slack_integration.decode_state(state)

    if state_data.get("subject_id") != str(auth_subject.subject.id):
        raise SlackIntegrationInvalidState(
            "Authorization must be completed by the same account that started it."
        )

    organization_id = state_data["organization_id"]
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(organization_id)
    if organization is None:
        raise ResourceNotFound()

    await assert_organization_permission(
        session,
        auth_subject,
        organization.id,
        OrganizationPermission.organization_manage,
    )

    redirect_uri = str(request.url_for(CALLBACK_ROUTE_NAME))
    await organization_slack_integration.complete_install(
        session, organization.id, code=code, redirect_uri=redirect_uri
    )

    return RedirectResponse(get_safe_return_url(state_data.get("return_to")), 303)


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

    repository = OrganizationSlackIntegrationRepository.from_session(session)
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
        await organization_slack_integration.handle_event(
            session, api_app_id=api_app_id, event=event
        )

    return JSONResponse({})
