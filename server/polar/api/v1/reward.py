from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.actions import repository, reward
from polar.api.deps import current_active_user, get_db_session
from polar.auth.repository import RepositoryAuth
from polar.models import User
from polar.models.reward import Reward
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.reward import RewardSchema

router = APIRouter(prefix="/rewards", tags=["rewards"])


@router.get("/{platform}/{organization_name}/{name}", response_model=list[RewardSchema])
async def get_repository_rewards(
    platform: Platforms,
    organization_name: str,
    name: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Reward]:

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

    rewards = await reward.list_by_repository(session=session, repository_id=repo.id)

    return rewards
