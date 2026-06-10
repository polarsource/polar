from typing import Any

from fastapi import Depends, Query, Request
from fastapi.responses import StreamingResponse

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models.llm_provider_config import LLMProviderConfig
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import LLMProviderConfig as LLMProviderConfigSchema
from .schemas import (
    LLMProviderConfigCreate,
    LLMProviderConfigID,
    LLMProviderConfigNotFound,
    LLMProviderConfigUpdate,
)
from .service import extract_polar_context, llm_gateway as llm_gateway_service

# --- Config CRUD Router ---

router = APIRouter(
    prefix="/llm-provider-configs",
    tags=["llm-provider-configs", APITag.public],
)


@router.get(
    "/",
    summary="List LLM Provider Configs",
    response_model=ListResource[LLMProviderConfigSchema],
)
async def list_configs(
    auth_subject: auth.LLMGatewayRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[LLMProviderConfigSchema]:
    """List LLM provider configurations."""
    results, count = await llm_gateway_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [LLMProviderConfigSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get LLM Provider Config",
    response_model=LLMProviderConfigSchema,
    responses={404: LLMProviderConfigNotFound},
)
async def get_config(
    id: LLMProviderConfigID,
    auth_subject: auth.LLMGatewayRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> LLMProviderConfig:
    """Get an LLM provider configuration by ID."""
    config = await llm_gateway_service.get(session, auth_subject, id)
    if config is None:
        raise ResourceNotFound()
    return config


@router.post(
    "/",
    response_model=LLMProviderConfigSchema,
    status_code=201,
    summary="Create LLM Provider Config",
    responses={201: {"description": "LLM provider config created."}},
)
async def create_config(
    config_create: LLMProviderConfigCreate,
    auth_subject: auth.LLMGatewayWrite,
    session: AsyncSession = Depends(get_db_session),
) -> LLMProviderConfig:
    """Create an LLM provider configuration."""
    return await llm_gateway_service.create(session, auth_subject, config_create)


@router.patch(
    "/{id}",
    response_model=LLMProviderConfigSchema,
    summary="Update LLM Provider Config",
    responses={200: {"description": "LLM provider config updated."}, 404: LLMProviderConfigNotFound},
)
async def update_config(
    id: LLMProviderConfigID,
    config_update: LLMProviderConfigUpdate,
    auth_subject: auth.LLMGatewayWrite,
    session: AsyncSession = Depends(get_db_session),
) -> LLMProviderConfig:
    """Update an LLM provider configuration."""
    config = await llm_gateway_service.get(session, auth_subject, id)
    if config is None:
        raise ResourceNotFound()
    return await llm_gateway_service.update(session, config, config_update)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete LLM Provider Config",
    responses={204: {"description": "LLM provider config deleted."}, 404: LLMProviderConfigNotFound},
)
async def delete_config(
    id: LLMProviderConfigID,
    auth_subject: auth.LLMGatewayWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete an LLM provider configuration."""
    config = await llm_gateway_service.get(session, auth_subject, id)
    if config is None:
        raise ResourceNotFound()
    await llm_gateway_service.delete(session, config)


# --- Proxy Router (OpenAI-compatible) ---

proxy_router = APIRouter(
    prefix="/llm/v1",
    tags=["llm-gateway", APITag.public],
)


@proxy_router.post(
    "/chat/completions",
    summary="Chat Completions",
)
async def chat_completions(
    request: Request,
    auth_subject: auth.LLMGatewayRead,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """
    OpenAI-compatible chat completions endpoint.

    Proxies requests to the configured LLM provider via LiteLLM.
    Supports both streaming and non-streaming responses.
    """
    body = await request.json()
    polar_ctx = extract_polar_context(request.headers)

    if body.get("stream", False):
        return StreamingResponse(
            llm_gateway_service.chat_completion_stream(
                session, auth_subject, body, polar_ctx=polar_ctx,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    result = await llm_gateway_service.chat_completion(
        session, auth_subject, body, polar_ctx=polar_ctx,
    )
    return result


@proxy_router.get(
    "/models",
    summary="List Models",
)
async def list_models(
    auth_subject: auth.LLMGatewayRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> dict[str, Any]:
    """
    OpenAI-compatible models list endpoint.

    Returns the list of models configured and enabled for the authenticated organization.
    """
    from polar.auth.models import is_organization
    from polar.authz.service import get_accessible_org_ids

    if is_organization(auth_subject):
        org_id = auth_subject.subject.id
    else:
        org_ids = await get_accessible_org_ids(session, auth_subject)
        if not org_ids:
            return {"object": "list", "data": []}
        org_id = next(iter(org_ids))

    models = await llm_gateway_service.list_models(session, org_id)
    return {"object": "list", "data": models}
