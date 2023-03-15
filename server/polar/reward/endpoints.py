from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue, Reward
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from polar.integrations.stripe.service import stripe

from .schemas import RewardCreate, RewardUpdate, RewardRead, State
from .service import reward

router = APIRouter(tags=["rewards"])


@router.post("/{platform}/{org_name}/{repo_name}/rewards", response_model=RewardRead)
async def create_rewawrd(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    reward: RewardCreate,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> RewardRead:
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

    # Create a payment intent with Stripe
    payment_intent = stripe.create_intent(amount=reward.amount, issue_id=issue.id)
    ret = RewardRead.from_orm(created)
    ret.client_secret = payment_intent.client_secret
    return ret


@router.patch("/rewards/{reward_id}", response_model=RewardRead)
async def patch_reward(
    reward_id: UUID,
    updates: RewardUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> RewardRead:
    reward = await Reward.find(session=session, id=reward_id)

    if not reward:
        raise HTTPException(
            status_code=404,
            detail="Reward not found",
        )

    reward.amount = updates.amount
    await reward.save(session=session)

    # Create a payment intent with Stripe
    payment_intent = stripe.create_intent(
        amount=reward.amount, issue_id=reward.issue_id
    )
    ret = RewardRead.from_orm(reward)
    ret.client_secret = payment_intent.client_secret
    return ret


@router.get(
    "/{platform}/{org_name}/{repo_name}/rewards", response_model=list[RewardRead]
)
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
