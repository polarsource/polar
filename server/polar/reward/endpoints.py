from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue, Reward
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .schemas import RewardCreate, RewardRead, State
from .service import reward

router = APIRouter()


@router.post("/{platform}/{org_name}/{repo_name}", response_model=RewardRead)
async def create_rewawrd(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    reward: RewardCreate,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Reward:
    issue = await Issue.find(session=session, id=reward.issue_id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if issue.repository_id != auth.repository.id:
        raise HTTPException(
            status_code=403, detail="Issue does not belong to this repository"
        )

    # Create the reward
    created = await Reward.create(
        session=session,
        issue_id=issue.id,
        repository_id=auth.repository.id,
        organization_id=auth.organization.id,
        amount=reward.amount,
        state=State.created,
    )

    return created


@router.get("/{platform}/{org_name}/{repo_name}", response_model=list[RewardRead])
async def get_repository_rewards(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Reward]:
    rewards = await reward.list_by_repository(
        session=session, repository_id=auth.repository.id
    )
    return rewards
