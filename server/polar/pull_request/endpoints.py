from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.api.deps import current_active_user, get_db_session
from polar.auth.repository import repository_auth
from polar.models import User
from polar.models.pull_request import PullRequest
from polar.organization.service import organization
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.repository.service import repository

from .schemas import PullRequestRead
from .service import pull_request

router = APIRouter()


@router.get(
    "/{platform}/{organization_name}/{name}", response_model=list[PullRequestRead]
)
async def get_repository_pull_requests(
    platform: Platforms,
    organization_name: str,
    name: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[PullRequest]:

    org = await organization.get_by(
        session=session,
        platform=platform,
        name=organization_name,
    )

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    repo = await repository.get_by(
        session=session,
        platform=platform,
        organization_id=org.id,
        name=name,
    )

    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # Validate that the user has access to the repository
    if not await repository_auth.can_write(session, user, repo):
        raise HTTPException(
            status_code=403,
            detail="User does not have access to this repository",
        )

    pull_requests = await pull_request.list_by_repository(
        session=session, repository_id=repo.id
    )

    return pull_requests
