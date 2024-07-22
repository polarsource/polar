import structlog
from fastapi import Depends, Query

from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Repository
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.product.service.product import (
    product as product_service,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Repository as RepositorySchema
from .schemas import (
    RepositoryID,
    RepositoryUpdate,
)
from .service import repository as repository_service

log = structlog.get_logger()

router = APIRouter(prefix="/repositories", tags=["repositories", APITag.documented])

RepositoryNotFound = {
    "description": "Repository not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/", summary="List Repositories", response_model=ListResource[RepositorySchema]
)
async def list(
    auth_subject: auth.RepositoriesReadOrAnonymous,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    platform: MultipleQueryFilter[Platforms] | None = Query(
        None, title="Platform Filter", description="Filter by platform."
    ),
    name: MultipleQueryFilter[str] | None = Query(
        None, title="RepositoryName Filter", description="Filter by name."
    ),
    external_organization_name: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalOrganizationName Filter",
        description="Filter by external organization name.",
    ),
    is_private: bool | None = Query(None, description="Filter by private status."),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[RepositorySchema]:
    """List repositories."""
    results, count = await repository_service.list(
        session,
        auth_subject,
        platform=platform,
        name=name,
        external_organization_name=external_organization_name,
        is_private=is_private,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [RepositorySchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Repository",
    response_model=RepositorySchema,
    responses={404: RepositoryNotFound},
)
async def get(
    id: RepositoryID,
    auth_subject: auth.RepositoriesReadOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> Repository:
    """Get a repository by ID."""
    repository = await repository_service.get_by_id(session, auth_subject, id)
    repo = await repository_service.get(session, id=id, load_organization=True)

    if repository is None:
        raise ResourceNotFound()

    return repository


@router.patch(
    "/{id}",
    response_model=RepositorySchema,
    summary="Update Repository",
    responses={
        200: {"description": "Repository updated."},
        403: {
            "description": "You don't have the permission to update this repository.",
            "model": NotPermitted.schema(),
        },
        404: RepositoryNotFound,
    },
)
async def update(
    id: RepositoryID,
    repository_update: RepositoryUpdate,
    auth_subject: auth.RepositoriesWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Repository:
    """Update a repository."""
    repository = await repository_service.get_by_id(session, auth_subject, id)

    if repository is None:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, repository):
        raise NotPermitted()

    if repository_update.profile_settings is not None:
        # validate featured organizations
        if repository_update.profile_settings.featured_organizations is not None:
            for org_id in repository_update.profile_settings.featured_organizations:
                if not await organization_service.get(session, id=org_id):
                    raise ResourceNotFound()

        # validate highlighted subscriptions
        if (
            repository_update.profile_settings.highlighted_subscription_tiers
            is not None
        ):
            for (
                tier_id
            ) in repository_update.profile_settings.highlighted_subscription_tiers:
                tier = await product_service.get_by_id(session, auth_subject, tier_id)
                raise NotImplementedError("TODO")

    return await repository_service.update_settings(
        session, repository, repository_update
    )
