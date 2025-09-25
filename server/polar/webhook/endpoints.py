from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4, AwareDatetime

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import WebhookEndpoint
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .auth import WebhooksRead, WebhooksWrite
from .schemas import WebhookDelivery as WebhookDeliverySchema
from .schemas import WebhookEndpoint as WebhookEndpointSchema
from .schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from .service import webhook as webhook_service

router = APIRouter(prefix="/webhooks", tags=["webhooks", APITag.public])

WebhookEndpointID = Annotated[UUID4, Path(description="The webhook endpoint ID.")]
WebhookEndpointNotFound = {
    "description": "Webhook endpoint not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/endpoints", response_model=ListResource[WebhookEndpointSchema])
async def list_webhook_endpoints(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookEndpointSchema]:
    """List webhook endpoints."""
    results, count = await webhook_service.list_endpoints(
        session,
        auth_subject,
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
) -> WebhookEndpoint:
    """Get a webhook endpoint by ID."""
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

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
) -> WebhookEndpoint:
    """
    Create a webhook endpoint.
    """
    return await webhook_service.create_endpoint(session, auth_subject, endpoint_create)


@router.patch(
    "/endpoints/{id}",
    response_model=WebhookEndpointSchema,
    responses={
        200: {"description": "Webhook endpoint updated."},
        404: WebhookEndpointNotFound,
    },
)
async def update_webhook_endpoint(
    id: WebhookEndpointID,
    update: WebhookEndpointUpdate,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> WebhookEndpoint:
    """
    Update a webhook endpoint.
    """
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    return await webhook_service.update_endpoint(
        session, endpoint=endpoint, update_schema=update
    )


@router.patch(
    "/endpoints/{id}/secret",
    response_model=WebhookEndpointSchema,
    responses={
        200: {"description": "Webhook endpoint secret reset."},
        404: WebhookEndpointNotFound,
    },
)
async def reset_webhook_endpoint_secret(
    id: WebhookEndpointID,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> WebhookEndpoint:
    """
    Regenerate a webhook endpoint secret.
    """
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    return await webhook_service.reset_endpoint_secret(session, endpoint=endpoint)


@router.delete(
    "/endpoints/{id}",
    status_code=204,
    responses={
        204: {"description": "Webhook endpoint deleted."},
        404: WebhookEndpointNotFound,
    },
)
async def delete_webhook_endpoint(
    id: WebhookEndpointID,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a webhook endpoint.
    """
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    await webhook_service.delete_endpoint(session, endpoint)


@router.get(
    "/deliveries",
    response_model=ListResource[WebhookDeliverySchema],
)
async def list_webhook_deliveries(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    endpoint_id: MultipleQueryFilter[UUID4] | None = Query(
        None, description="Filter by webhook endpoint ID."
    ),
    start_timestamp: AwareDatetime | None = Query(
        None, description="Filter deliveries after this timestamp."
    ),
    end_timestamp: AwareDatetime | None = Query(
        None, description="Filter deliveries before this timestamp."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookDeliverySchema]:
    """
    List webhook deliveries.

    Deliveries are all the attempts to deliver a webhook event to an endpoint.
    """
    results, count = await webhook_service.list_deliveries(
        session,
        auth_subject,
        endpoint_id=endpoint_id,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        pagination=pagination,
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
) -> None:
    """
    Schedule the re-delivery of a webhook event.
    """
    return await webhook_service.redeliver_event(session, auth_subject, id)
