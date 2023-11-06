from uuid import UUID

from fastapi import APIRouter, Depends, Query

from polar.auth.dependencies import Auth
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Repository
from polar.organization.dependencies import OrganizationNamePlatform
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


@router.get("/search", response_model=ListResource[IssueFunding], tags=[Tags.PUBLIC])
async def search(
    pagination: PaginationParamsQuery,
    organization_name_platform: OrganizationNamePlatform,
    repository_name: OptionalRepositoryNameQuery = None,
    query: str | None = Query(None),
    badged: bool | None = Query(None),
    closed: bool | None = Query(None),
    sorting: ListFundingSorting = [ListFundingSortBy.newest],
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> ListResource[IssueFunding]:
    organization_name, platform = organization_name_platform
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
        auth.subject,
        query=query,
        organization=organization,
        repository=repository,
        badged=badged,
        closed=closed,
        sorting=sorting,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [IssueFunding.from_list_by_result(result) for result in results],
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
    auth: Auth = Depends(Auth.optional_user),
) -> IssueFunding:
    result = await funding_service.get_by_issue_id(
        session, auth.subject, issue_id=issue_id
    )

    if result is None:
        raise ResourceNotFound()

    return IssueFunding.from_list_by_result(result)
