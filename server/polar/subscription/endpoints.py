from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Repository, SubscriptionGroup
from polar.organization.dependencies import OrganizationNameQuery
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags

from .schemas import SubscriptionGroup as SubscriptionGroupSchema
from .schemas import SubscriptionGroupCreate, SubscriptionGroupUpdate
from .service.subscription_group import subscription_group as subscription_group_service

router = APIRouter(prefix="/subscriptions", tags=["subscription"])


@router.get(
    "/groups/search",
    response_model=ListResource[SubscriptionGroupSchema],
    tags=[Tags.PUBLIC],
)
async def search_subscription_groups(
    pagination: PaginationParamsQuery,
    organization_name: OrganizationNameQuery,
    repository_name: OptionalRepositoryNameQuery = None,
    direct_organization: bool = Query(True),
    platform: Platforms = Query(...),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[SubscriptionGroupSchema]:
    organization = await organization_service.get_by_name(
        session, platform, organization_name
    )
    if organization is None:
        raise ResourceNotFound("Organization not found")

    repository: Repository | None = None
    if repository_name is not None:
        repository = await repository_service.get_by_org_and_name(
            session, organization.id, repository_name
        )
        if repository is None:
            raise ResourceNotFound("Repository not found")

    results, count = await subscription_group_service.search(
        session,
        auth.subject,
        organization=organization,
        repository=repository,
        direct_organization=direct_organization,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SubscriptionGroupSchema.from_orm(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/groups/",
    response_model=SubscriptionGroupSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_subscription_group(
    subscription_group_create: SubscriptionGroupCreate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    return await subscription_group_service.user_create(
        session, authz, subscription_group_create, auth.user
    )


@router.post("/groups/{id}", response_model=SubscriptionGroupSchema, tags=[Tags.PUBLIC])
async def update_subscription_group(
    id: UUID4,
    subscription_group_update: SubscriptionGroupUpdate,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionGroup:
    subscription_group = (
        await subscription_group_service.get_with_organization_or_repository(
            session, id
        )
    )

    if subscription_group is None:
        raise ResourceNotFound()

    if not await authz.can(auth.user, AccessType.write, subscription_group):
        raise NotPermitted()

    return await subscription_group_service.update(
        session, subscription_group, subscription_group_update, exclude_unset=True
    )
