from fastapi import Depends, Query
from pydantic import UUID4

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import SearchResults
from .service import search as search_service

router = APIRouter(tags=["search", APITag.private])


@router.get("/search", response_model=SearchResults)
async def search(
    auth_subject: auth.SearchRead,
    organization_id: UUID4 = Query(..., description="Organization ID to search within"),
    query: str = Query(..., description="Search query string"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results"),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SearchResults:
    """
    Internal search endpoint for dashboard.
    """
    results = await search_service.search(
        session,
        auth_subject,
        organization_id=organization_id,
        query=query,
        limit=limit,
    )

    return SearchResults(results=results)
