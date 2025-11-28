from fastapi import Depends, Query
from fastapi.responses import RedirectResponse

from polar.benefit.schemas import BenefitID
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.downloadables import DownloadableRead
from ..service.downloadables import downloadable as downloadable_service

router = APIRouter(prefix="/downloadables", tags=["downloadables", APITag.public])


@router.get(
    "/",
    summary="List Downloadables",
    response_model=ListResource[DownloadableRead],
)
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    benefit_id: MultipleQueryFilter[BenefitID] | None = Query(
        None, title="BenefitID Filter", description="Filter by benefit ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DownloadableRead]:
    results, count = await downloadable_service.get_list(
        session,
        auth_subject,
        pagination=pagination,
        benefit_id=benefit_id,
    )

    return ListResource.from_paginated_results(
        downloadable_service.generate_downloadable_schemas(results),
        count,
        pagination,
    )


@router.get(
    "/{token}",
    summary="Get Downloadable",
    responses={
        302: {"description": "Redirected to download"},
        400: {"description": "Invalid signature"},
        404: {"description": "Downloadable not found"},
        410: {"description": "Expired signature"},
    },
    name="customer_portal.downloadables.get",
    tags=[APITag.private],
)
async def get(
    token: str,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    downloadable = await downloadable_service.get_from_token_or_raise(
        session, token=token
    )
    signed = downloadable_service.generate_download_schema(downloadable)
    return RedirectResponse(signed.file.download.url, 302)
