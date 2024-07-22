from uuid import UUID

from fastapi import Depends

from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, Pagination
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import WebhookIntegration as WebhookIntegrationSchema
from .schemas import WebhookIntegrationCreate, WebhookIntegrationUpdate
from .service import webhook_notifications_service

router = APIRouter(tags=["webhook_notifications"])


@router.get(
    "/webhook_notifications/search",
    response_model=ListResource[WebhookIntegrationSchema],
    description="Search webhook notification integrations.",
    summary="Search webhook notification integrations",
    status_code=200,
    responses={404: {}},
)
async def search(
    organization_id: OrganizationID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[WebhookIntegrationSchema]:
    org = await organization_service.get(session, organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    results = await webhook_notifications_service.search(
        session,
        organization_id=org.id,
    )

    return ListResource(
        items=[WebhookIntegrationSchema.model_validate(r) for r in results],
        pagination=Pagination(total_count=len(results), max_page=1),
    )


@router.post(
    "/webhook_notifications",
    response_model=WebhookIntegrationSchema,
    description="Create a webhook notification integration.",
    summary="Create a webhook notification integration",
    status_code=200,
    responses={404: {}},
)
async def create(
    create: WebhookIntegrationCreate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookIntegrationSchema:
    org = await organization_service.get(session, create.organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    res = await webhook_notifications_service.create(session, create_schema=create)

    return WebhookIntegrationSchema.model_validate(res)


@router.post(
    "/webhook_notifications/{id}",
    response_model=WebhookIntegrationSchema,
    description="Update webhook notification integration.",
    summary="Update webhook notification integration",
    status_code=200,
    responses={404: {}},
)
async def update(
    id: UUID,
    update: WebhookIntegrationUpdate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookIntegrationSchema:
    wn = await webhook_notifications_service.get(session, id)
    if not wn:
        raise ResourceNotFound()

    org = await organization_service.get(session, wn.organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    res = await webhook_notifications_service.update(session, webhook=wn, update=update)

    return WebhookIntegrationSchema.model_validate(res)


@router.delete(
    "/webhook_notifications/{id}",
    response_model=WebhookIntegrationSchema,
    description="Delete webhook notification integration.",
    summary="Delete webhook notification integration",
    status_code=200,
    responses={404: {}},
)
async def delete(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> WebhookIntegrationSchema:
    wn = await webhook_notifications_service.get(session, id)
    if not wn:
        raise ResourceNotFound()

    org = await organization_service.get(session, wn.organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    res = await webhook_notifications_service.delete(session, webhook=wn)

    return WebhookIntegrationSchema.model_validate(res)
