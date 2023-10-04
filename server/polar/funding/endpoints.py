from fastapi import APIRouter, Depends, Query

from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.models import Repository
from polar.organization.dependencies import OrganizationNameQuery
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.types import ListResource, Pagination

from .dependencies import ListFundingSorting
from .schemas import IssueFunding
from .service import ListFundingSortBy
from .service import funding as funding_service

router = APIRouter(prefix="/funding", tags=["funding"])


@router.get(
    "/", name="list", response_model=ListResource[IssueFunding], tags=[Tags.PUBLIC]
)
async def list_funding(
    organization_name: OrganizationNameQuery,
    repository_name: OptionalRepositoryNameQuery = None,
    sorting: ListFundingSorting = [ListFundingSortBy.newest],
    platform: Platforms = Query(...),
    session: AsyncSession = Depends(get_db_session),
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

    rows = await funding_service.list_by(
        session, organization=organization, repository=repository, sorting=sorting
    )
    return ListResource(
        items=[IssueFunding.from_list_by_row(row) for row in rows],
        pagination=Pagination(total_count=len(rows)),
    )
