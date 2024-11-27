from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import ActivitySchema

router = APIRouter(prefix="/activity", tags=["activity", APITag.documented])


ActivityNotFound = {
    "description": "Activity not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Activities", response_model=ListResource[ActivitySchema])
async def list(
    auth_subject: auth.ActivityRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[ActivitySchema]:
    """List checkout links."""
    results, count = await activity_service.list(
        session,
        auth_subject,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [ActivitySchema.model_validate(result) for result in results],
        count,
        pagination,
    )
