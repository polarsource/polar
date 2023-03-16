from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models import Issue, Pledge
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from polar.integrations.stripe.service import stripe

from .schemas import PledgeCreate, PledgeUpdate, PledgeRead, State
from .service import pledge

router = APIRouter(tags=["pledges"])


@router.post("/{platform}/{org_name}/{repo_name}/pledges", response_model=PledgeRead)
async def create_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    pledge: PledgeCreate,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    issue = await Issue.find(session=session, id=pledge.issue_id)

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
    payment_intent = stripe.create_intent(amount=pledge.amount, issue_id=issue.id)

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=auth.repository.id,
        organization_id=auth.organization.id,
        email=pledge.email,
        amount=pledge.amount,
        state=State.initiated,
        payment_id=payment_intent.id,
    )

    ret = PledgeRead.from_orm(created)
    ret.client_secret = payment_intent.client_secret

    return ret


@router.patch(
    "/{platform}/{org_name}/{repo_name}/pledges/{pledge_id}", response_model=PledgeRead
)
async def update_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    pledge_id: UUID,
    updates: PledgeUpdate,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    pledge = await Pledge.find(session=session, id=pledge_id)

    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )

    if pledge.repository_id != auth.repository.id:
        raise HTTPException(
            status_code=403, detail="Pledge does not belong to this repository"
        )

    payment_intent = None

    if updates.amount and updates.amount != pledge.amount:
        pledge.amount = updates.amount
        payment_intent = stripe.modify_intent(pledge.payment_id, amount=pledge.amount)

    if updates.email and updates.email != pledge.email:
        pledge.email = updates.email

    if payment_intent is None:
        payment_intent = stripe.retrieve_intent(pledge.payment_id)

    await pledge.save(session=session)

    ret = PledgeRead.from_orm(pledge)
    ret.client_secret = payment_intent.client_secret

    return ret


@router.get(
    "/{platform}/{org_name}/{repo_name}/pledges", response_model=list[PledgeRead]
)
async def get_repository_pledges(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Pledge]:
    pledges = await pledge.list_by_repository(
        session=session, repository_id=auth.repository.id
    )
    return pledges
