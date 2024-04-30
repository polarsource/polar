from uuid import UUID

import structlog
from fastapi import Depends, Query

from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import WebhookEndpoint
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import WebhookDelivery as WebhookDeliverySchema
from .schemas import WebhookEndpoint as WebhookEndpointSchema
from .schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from .service import webhook_service

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
    auth_subject: WebUser,
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
    auth_subject: WebUser,
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
    create: WebhookEndpointCreate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    if not create.user_id and not create.organization_id:
        raise BadRequest("neither user_id nor organization_id is set")

    if create.user_id:
        if create.user_id != auth_subject.subject.id:
            raise BadRequest("user_id is not the current users ID")

    if create.organization_id:
        org = await organization_service.get(session, create.organization_id)
        if not org:
            raise ResourceNotFound("organization not found")

        if not await authz.can(auth_subject.subject, AccessType.write, org):
            raise Unauthorized()

    return await webhook_service.create_endpoint(session, auth_subject, create=create)


@router.patch(
    "/endpoints/{id}",
    response_model=WebhookEndpointSchema,
    tags=[Tags.PUBLIC],
    description="Update a Webhook Endpoint",
)
async def update_webhook_endpoint(
    id: UUID,
    update: WebhookEndpointUpdate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpoint:
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, endpoint):
        raise Unauthorized()

    return await webhook_service.update_endpoint(
        session, auth_subject, endpoint=endpoint, update=update
    )


@router.delete(
    "/endpoints/{id}",
    tags=[Tags.PUBLIC],
    description="Delete a Webhook Endpoint",
    status_code=204,
)
async def delete_webhook_endpoint(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    endpoint = await webhook_service.get_endpoint(session, auth_subject, id)
    if not endpoint:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, endpoint):
        raise Unauthorized()

    await webhook_service.delete_endpoint(session, auth_subject, id)


@router.get(
    "/deliveries",
    response_model=ListResource[WebhookDeliverySchema],
    tags=[Tags.PUBLIC],
    description="List Webhook Deliveries",
)
async def list_webhook_deliveries(
    pagination: PaginationParamsQuery,
    auth_subject: WebUser,
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
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    return await webhook_service.redeliver_event(session, auth_subject, id)
