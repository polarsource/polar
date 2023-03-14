from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.models.pull_request import PullRequest
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .schemas import PullRequestRead
from .service import pull_request

router = APIRouter()


@router.get("/{platform}/{org_name}/{repo_name}", response_model=list[PullRequestRead])
async def get_repository_pull_requests(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[PullRequest]:
    pull_requests = await pull_request.list_by_repository(
        session=session, repository_id=auth.repository.id
    )
    return pull_requests
