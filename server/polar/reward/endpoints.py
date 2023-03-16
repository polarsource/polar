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
async def create_reward(
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

    # Create a payment intent with Stripe
    payment_intent = stripe.create_intent(amount=reward.amount, issue_id=issue.id)

    # Create the reward
    created = await Reward.create(
        session=session,
        issue_id=issue.id,
        repository_id=auth.repository.id,
        organization_id=auth.organization.id,
        email=reward.email,
        amount=reward.amount,
        state=State.initiated,
        payment_id=payment_intent.id,
    )

    ret = RewardRead.from_orm(created)
    ret.client_secret = payment_intent.client_secret

    return ret


@router.patch(
    "/{platform}/{org_name}/{repo_name}/rewards/{reward_id}", response_model=RewardRead
)
async def patch_reward(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    reward_id: UUID,
    updates: RewardUpdate,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> RewardRead:
    reward = await Reward.find(session=session, id=reward_id)

    if not reward:
        raise HTTPException(
            status_code=404,
            detail="Reward not found",
        )

    if reward.repository_id != auth.repository.id:
        raise HTTPException(
            status_code=403, detail="Reward does not belong to this repository"
        )

    payment_intent = None

    if updates.amount and updates.amount != reward.amount:
        reward.amount = updates.amount
        payment_intent = stripe.modify_intent(reward.payment_id, amount=reward.amount)

    if updates.email and updates.email != reward.email:
        reward.email = updates.email

    if payment_intent is None:
        payment_intent = stripe.retrieve_intent(reward.payment_id)

    await reward.save(session=session)

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
