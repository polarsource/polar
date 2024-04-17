from uuid import UUID

import structlog
from fastapi import Depends

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, Unauthorized
from polar.integrations.github.client import NotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import (
    WebhookDelivery as WebhookDeliverySchema,
)
from .schemas import (
    WebhookEndpoint as WebhookEndpointSchema,
)
from .schemas import (
    WebhookEndpointCreate,
)
from .service import webhook_service

log = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get(
    "/endpoints/lookup",
    response_model=WebhookEndpointSchema,
    tags=[Tags.PUBLIC],
)
async def lookup_webhook_endpoint(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpointSchema:
    endpoint = await webhook_service.get_endpoint(session, id)
    if not endpoint:
        raise NotFound()

    if not await authz.can(auth.subject, AccessType.write, endpoint):
        raise Unauthorized()

    return WebhookEndpointSchema.model_validate(endpoint)


@router.get(
    "/endpoints/search",
    response_model=ListResource[WebhookEndpointSchema],
    tags=[Tags.PUBLIC],
)
async def search_webhook_endpoints(
    pagination: PaginationParamsQuery,
    organization_id: UUID | None = None,
    user_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[WebhookEndpointSchema]:
    if not user_id and not organization_id:
        raise BadRequest("neither user_id nor organization_id provided")

    assert auth.user

    if user_id:
        if user_id != auth.user.id:
            raise BadRequest("user_id is not the current users ID")

    if organization_id:
        org = await organization_service.get(session, organization_id)
        if not org:
            raise NotFound("organization not found")

        if not await authz.can(auth.subject, AccessType.write, org):
            raise Unauthorized()

    results, count = await webhook_service.search_endpoints(
        session,
        user_id=user_id,
        organization_id=organization_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [WebhookEndpointSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/endpoints",
    response_model=WebhookEndpointSchema,
    tags=[Tags.PUBLIC],
)
async def create_webhook_endpoint(
    create: WebhookEndpointCreate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> WebhookEndpointSchema:
    if not create.user_id and not create.organization_id:
        raise BadRequest("neither user_id nor organization_id is set")

    assert auth.user

    if create.user_id:
        if create.user_id != auth.user.id:
            raise BadRequest("user_id is not the current users ID")

    if create.organization_id:
        org = await organization_service.get(session, create.organization_id)
        if not org:
            raise NotFound("organization not found")

        if not await authz.can(auth.subject, AccessType.write, org):
            raise Unauthorized()

    endpoint = await webhook_service.create_endpoint(
        session,
        url=str(create.url),
        secret=create.secret,
        user_id=create.user_id,
        organization_id=create.organization_id,
    )

    return WebhookEndpointSchema.model_validate(endpoint)


@router.get(
    "/deliveries/search",
    response_model=ListResource[WebhookDeliverySchema],
    tags=[Tags.PUBLIC],
)
async def search_webhook_deliveries(
    pagination: PaginationParamsQuery,
    webhook_endpoint_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[WebhookDeliverySchema]:
    endpoint = await webhook_service.get_endpoint(session, webhook_endpoint_id)
    if not endpoint:
        raise NotFound()

    if not await authz.can(auth.subject, AccessType.write, endpoint):
        raise Unauthorized()

    results, count = await webhook_service.search_deliveries(
        session,
        endpoint_id=webhook_endpoint_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [WebhookDeliverySchema.model_validate(result) for result in results],
        count,
        pagination,
    )
