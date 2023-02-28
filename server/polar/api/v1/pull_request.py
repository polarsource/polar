from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException
from polar.actions import pull_request, repository
from polar.api.deps import current_active_user, get_db_session
from polar.auth.repository import RepositoryAuth
from polar.models import User
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.pull_request import PullRequestSchema

router = APIRouter(prefix="/pull_requests", tags=["pull_requests"])


@router.get(
    "/{platform}/{organization_name}/{name}", response_model=list[PullRequestSchema]
)
async def get_repository_pull_requests(
    platform: Platforms,
    organization_name: str,
    name: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[PullRequest]:

    repo = await repository.get_by(
        session=session,
        platform=platform,
        organization_name=organization_name,
        name=name,
    )

    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # Validate that the user has access to the repository
    if not RepositoryAuth.can_write(session, user, repo):
        raise HTTPException(
            status_code=403,
            detail="User does not have access to this repository",
        )

    pull_requests = await pull_request.list_by_repository(
        session=session, repository_id=repo.id
    )

    return pull_requests
