import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar.auth.dependencies import Auth
from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.models.organization import Organization
from polar.models.pledge import Pledge as PledgeModel
from polar.models.pledge_split import PledgeSplit as PledgeSplitModel
from polar.models.pledge_transaction import PledgeTransaction as PledgeTransactionModel
from polar.organization.schemas import Organization as OrganizationSchema
from polar.organization.service import organization as organization_service
from polar.pledge.schemas import Pledge
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.types import ListResource
from polar.user.schemas import User
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import Reward, RewardState
from .service import reward_service

router = APIRouter(tags=["rewards"])


@router.get(
    "/rewards/search",
    response_model=ListResource[Reward],
    tags=[Tags.PUBLIC],
    description="Search rewards.",
    summary="Search rewards (Public API)",
    status_code=200,
)
async def search(
    # pledges_to_organization_platform: Platforms | None = None,
    pledges_to_organization: UUID
    | None = Query(
        default=None,
        description="Search rewards for pledges in this organization.",  # noqa: E501
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
) -> ListResource[Reward]:
    if not pledges_to_organization:
        raise HTTPException(
            status_code=401,
            detail="pledges_to_organization is not set",
        )

    org = await organization_service.get(
        session,
        # platform=Platforms.github,
        id=pledges_to_organization,
    )

    if not org:
        raise HTTPException(
            status_code=404,
            detail="pledges_to_organization organization not found",
        )

    if not await user_can_read(session, auth, org):
        raise HTTPException(
            status_code=401,
            detail="Access denied",
        )

    rewards = await reward_service.list(
        session,
        org_id=org.id,
    )

    def to_resource(
        pledge: PledgeModel,
        pledge_split: PledgeSplitModel,
        transaction: PledgeTransactionModel,
    ) -> Reward:
        user = None
        if pledge_split and pledge_split.user:
            user = User.from_db(pledge_split.user)
        elif pledge_split.github_username:
            user = User(username=pledge_split.github_username, avatar_url="x")

        organization = None
        if pledge_split.organization:
            organization = OrganizationSchema.from_db(pledge_split.organization)

        if transaction and transaction.amount:
            amount = CurrencyAmount(currency="USD", amount=transaction.amount)
        else:
            amount = CurrencyAmount(
                currency="USD", amount=round(pledge.amount * 0.9 * pledge_split.share)
            )

        return Reward(
            pledge=Pledge.from_db(pledge),
            user=user,
            organization=organization,
            amount=amount,
            state=RewardState.paid if transaction else RewardState.pending,
        )

    return ListResource(
        items=[
            to_resource(pledge, reward, transaction)
            for pledge, reward, transaction in rewards
        ]
    )


async def user_can_read(session: AsyncSession, auth: Auth, org: Organization) -> bool:
    if not auth.user:
        return False

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    ids = [m.organization_id for m in user_memberships if m.is_admin is True]

    if org.id in ids:
        return True

    return False
