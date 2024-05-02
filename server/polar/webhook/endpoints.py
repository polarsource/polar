from uuid import UUID

import structlog
from fastapi import Depends, Query

from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import WebhookEndpoint
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .auth import WebhooksRead, WebhooksWrite
from .schemas import WebhookDelivery as WebhookDeliverySchema
from .schemas import WebhookEndpoint as WebhookEndpointSchema
from .schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from .service import webhook as webhook_service

log = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get(
    "/endpoints",
    response_model=ListResource[WebhookEndpointSchema],
    tags=[Tags.PUBLIC],
    description="List Webhook Endpoints",
    status_code=200,
)
async def list_webhook_endpoints(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    organization_id: UUID | None = None,
    user_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookEndpointSchema]:
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
    tags=[Tags.PUBLIC],
    description="Get a Webhook Endpoint",
)
async def get_webhook_endpoint(
    id: UUID,
    auth_subject: WebhooksRead,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, endpoint):
        raise Unauthorized()

    return endpoint


@router.post(
    "/endpoints",
    response_model=WebhookEndpointSchema,
    tags=[Tags.PUBLIC],
    description="Create a new Webhook Endpoint",
    status_code=201,
)
async def create_webhook_endpoint(
    endpoint_create: WebhookEndpointCreate,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    return await webhook_service.create_endpoint(
        session, authz, auth_subject, endpoint_create
    )


@router.patch(
    "/endpoints/{id}",
    response_model=WebhookEndpointSchema,
    tags=[Tags.PUBLIC],
    description="Update a Webhook Endpoint",
)
async def update_webhook_endpoint(
    id: UUID,
    update: WebhookEndpointUpdate,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    return await webhook_service.update_endpoint(
        session, authz, auth_subject, endpoint=endpoint, update_schema=update
    )


@router.delete(
    "/endpoints/{id}",
    tags=[Tags.PUBLIC],
    description="Delete a Webhook Endpoint",
    status_code=204,
)
async def delete_webhook_endpoint(
    id: UUID,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    await webhook_service.delete_endpoint(session, authz, auth_subject, endpoint)


@router.get(
    "/deliveries",
    response_model=ListResource[WebhookDeliverySchema],
    tags=[Tags.PUBLIC],
    description="List Webhook Deliveries",
)
async def list_webhook_deliveries(
    pagination: PaginationParamsQuery,
    auth_subject: WebhooksRead,
    endpoint_id: UUID | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[WebhookDeliverySchema]:
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
    tags=[Tags.PUBLIC],
    description="Schedule a re-delivery of a Webhook Event",
    status_code=202,
)
async def redeliver_webhook_event(
    id: UUID,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    return await webhook_service.redeliver_event(session, authz, auth_subject, id)
