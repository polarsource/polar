from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.authz.service import Authz
from polar.kit.pagination import ListResource, Pagination
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.tags.api import Tags

from .schemas import PullRequest

router = APIRouter(tags=["pull_requests"])


@router.get(
    "/pull_requests/search",
    response_model=ListResource[PullRequest],
    tags=[Tags.PUBLIC],
    description="Search pull requests.",
    summary="Search pull requests (Public API)",
    status_code=200,
    responses={404: {}},
)
async def search(
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[PullRequest]:
    # TODO: implement a new way to list PR?

    return ListResource(
        items=[],
        pagination=Pagination(total_count=0, max_page=1),
    )
