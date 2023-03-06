from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.actions import repository, reward
from polar.api.deps import current_active_user, get_db_session
from polar.auth.repository import repository_auth
from polar.models import User
from polar.models.issue import Issue
from polar.models.reward import Reward
from polar.organization.service import organization
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.reward import RewardCreate, RewardRead, State

router = APIRouter()


@router.post("", response_model=RewardRead)
async def create_rewawrd(
    reward: RewardCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Reward:
    issue = await Issue.find(session=session, id=reward.issue_id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not issue.repository_id:
        raise HTTPException(
            status_code=404,
            detail="Issue does not belong to a repository",
        )

    repo = await repository.get(
        session=session,
        id=issue.repository_id,
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

    # Create the reward
    created = await Reward.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=repo.organization_id,
        amount=reward.amount,
        state=State.created,
    )

    return created


@router.get("/{platform}/{organization_name}/{name}", response_model=list[RewardRead])
async def get_repository_rewards(
    platform: Platforms,
    organization_name: str,
    name: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Reward]:

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

    rewards = await reward.list_by_repository(session=session, repository_id=repo.id)

    return rewards
