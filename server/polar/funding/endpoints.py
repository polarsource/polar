from uuid import UUID

from fastapi import APIRouter, Depends, Query

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.locker import Locker, get_locker
from polar.models import Repository
from polar.organization.dependencies import OrganizationNameQuery
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags

from .dependencies import ListFundingSorting
from .schemas import IssueFunding
from .service import ListFundingSortBy
from .service import funding as funding_service

router = APIRouter(prefix="/funding", tags=["funding"])


# TODO: this should be /search to be consistent with other endpoints
@router.get(
    "/", name="list", response_model=ListResource[IssueFunding], tags=[Tags.PUBLIC]
)
async def list_funding(
    pagination: PaginationParamsQuery,
    organization_name: OrganizationNameQuery,
    repository_name: OptionalRepositoryNameQuery = None,
    badged: bool | None = Query(None),
    sorting: ListFundingSorting = [ListFundingSortBy.newest],
    platform: Platforms = Query(...),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[IssueFunding]:
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

    results, count = await funding_service.list_by(
        session,
        organization=organization,
        repository=repository,
        badged=badged,
        sorting=sorting,
        pagination=pagination,
    )

    items = [
        IssueFunding.from_list_by_row(result)
        for result in results
        if await authz.can(auth.subject, AccessType.read, result[0])
    ]
    return ListResource.from_paginated_results(
        items,
        count,
        pagination,
    )


@router.get(
    "/lookup",
    name="lookup",
    response_model=IssueFunding,
    tags=[Tags.PUBLIC],
)
async def lookup(
    issue_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
) -> IssueFunding:
    rows = await funding_service.list_by(
        session,
        issue_ids=[issue_id],
    )

    if len(rows) != 1:
        raise ResourceNotFound()

    row = rows[0]
    issue = row[0]

    if not await authz.can(auth.subject, AccessType.read, issue):
        raise Unauthorized()

    return IssueFunding.from_list_by_row(row)
