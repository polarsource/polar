from typing import Annotated

import structlog
from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import WebhookEndpoint
from polar.postgres import AsyncSession, get_db_session

from .auth import WebhooksRead, WebhooksWrite
from .schemas import WebhookDelivery as WebhookDeliverySchema
from .schemas import WebhookEndpoint as WebhookEndpointSchema
from .schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from .service import webhook as webhook_service

log = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

WebhookEndpointID = Annotated[UUID4, Path(description="The webhook endpoint ID.")]
WebhookEndpointNotFound = {
    "description": "Webhook endpoint not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/endpoints", response_model=ListResource[WebhookEndpointSchema])
async def list_webhook_endpoints(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    user_id: UUID4 | None = Query(None, description="Filter by user ID."),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookEndpointSchema]:
    """List webhook endpoints."""
    results, count = await webhook_service.list_endpoints(
        session,
        auth_subject,
        user_id=user_id,
        organization_id=organization_id,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(
        [WebhookEndpointSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/endpoints/{id}",
    response_model=WebhookEndpointSchema,
    responses={404: WebhookEndpointNotFound},
)
async def get_webhook_endpoint(
    id: WebhookEndpointID,
    auth_subject: WebhooksRead,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    """Get a webhook endpoint by ID."""
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, endpoint):
        raise Unauthorized()

    return endpoint


@router.post(
    "/endpoints",
    response_model=WebhookEndpointSchema,
    status_code=201,
    responses={201: {"description": "Webhook endpoint created."}},
)
async def create_webhook_endpoint(
    endpoint_create: WebhookEndpointCreate,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    """
    Create a webhook endpoint.
    """
    return await webhook_service.create_endpoint(
        session, authz, auth_subject, endpoint_create
    )


@router.patch(
    "/endpoints/{id}",
    response_model=WebhookEndpointSchema,
    responses={
        200: {"description": "Webhook endpoint updated."},
        403: {
            "description": "You don't have the permission to update this webhook endpoint.",
            "model": NotPermitted.schema(),
        },
        404: WebhookEndpointNotFound,
    },
)
async def update_webhook_endpoint(
    id: WebhookEndpointID,
    update: WebhookEndpointUpdate,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    """
    Update a webhook endpoint.
    """
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    return await webhook_service.update_endpoint(
        session, authz, auth_subject, endpoint=endpoint, update_schema=update
    )


@router.delete(
    "/endpoints/{id}",
    status_code=204,
    responses={
        204: {"description": "Webhook endpoint deleted."},
        403: {
            "description": "You don't have the permission to delete this webhook endpoint.",
            "model": NotPermitted.schema(),
        },
        404: WebhookEndpointNotFound,
    },
)
async def delete_webhook_endpoint(
    id: WebhookEndpointID,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """
    Delete a webhook endpoint.
    """
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    await webhook_service.delete_endpoint(session, authz, auth_subject, endpoint)


@router.get(
    "/deliveries",
    response_model=ListResource[WebhookDeliverySchema],
)
async def list_webhook_deliveries(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    endpoint_id: UUID4 | None = Query(
        None, description="Filter by webhook endpoint ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookDeliverySchema]:
    """
    List webhook deliveries.

    Deliveries are all the attempts to deliver a webhook event to an endpoint.
    """
    results, count = await webhook_service.list_deliveries(
        session, auth_subject, endpoint_id=endpoint_id, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [WebhookDeliverySchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/events/{id}/redeliver",
    status_code=202,
    responses={
        202: {"description": "Webhook event re-delivery scheduled."},
        404: {
            "description": "Webhook event not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def redeliver_webhook_event(
    id: Annotated[UUID4, Path(..., description="The webhook event ID.")],
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """
    Schedule the re-delivery of a webhook event.
    """
    return await webhook_service.redeliver_event(session, authz, auth_subject, id)
