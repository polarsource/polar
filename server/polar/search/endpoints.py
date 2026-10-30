from typing import Annotated

from fastapi import Depends, Query

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import SearchResults, SearchSearchParams
from .service import search as search_service

router = APIRouter(tags=["search", APITag.private])


@router.get("/search", response_model=SearchResults)
async def search(
    filters: Annotated[SearchSearchParams, Query()],
    auth_subject: auth.SearchRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SearchResults:
    """
    Internal search endpoint for dashboard.
    """
    results = await search_service.search(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        query=filters.query,
        limit=filters.limit,
    )

    return SearchResults(results=results)
