import structlog
from fastapi import Depends, Query
from fastapi.responses import RedirectResponse

from polar.benefit.schemas import BenefitID
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.downloadables import DownloadableRead
from ..service.downloadables import downloadable as downloadable_service

log = structlog.get_logger()

router = APIRouter(prefix="/downloadables", tags=[APITag.documented, APITag.featured])


@router.get(
    "/",
    response_model=ListResource[DownloadableRead],
)
async def list_downloadables(
    auth_subject: auth.UserDownloadablesRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    benefit_id: MultipleQueryFilter[BenefitID] | None = Query(
        None,
        title="BenefitID Filter",
        description=("Filter by given benefit ID. "),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DownloadableRead]:
    subject = auth_subject.subject

    results, count = await downloadable_service.get_list(
        session,
        user=subject,
        pagination=pagination,
        organization_id=organization_id,
        benefit_id=benefit_id,
    )

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


@router.get(
    "/{token}",
    responses={
        302: {"description": "Redirected to download"},
        400: {"description": "Invalid signature"},
        404: {"description": "Downloadable not found"},
        410: {"description": "Expired signature"},
    },
)
async def get_downloadable(
    token: str,
    auth_subject: auth.UserDownloadablesRead,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    subject = auth_subject.subject

    downloadable = await downloadable_service.get_from_token_or_raise(
        session, user=subject, token=token
    )
    signed = downloadable_service.generate_download_schema(downloadable)
    return RedirectResponse(signed.file.download.url, 302)
