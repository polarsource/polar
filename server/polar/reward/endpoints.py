from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz, Subject
from polar.currency.schemas import CurrencyAmount
from polar.models.issue_reward import IssueReward
from polar.models.pledge import Pledge as PledgeModel
from polar.models.pledge_transaction import PledgeTransaction as PledgeTransactionModel
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.types import ListResource, Pagination
from polar.user.schemas import User

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
    pledges_to_organization: UUID
    | None = Query(
        default=None,
        description="Search rewards for pledges in this organization.",  # noqa: E501
    ),
    rewards_to_user: UUID
    | None = Query(
        default=None,
        description="Search rewards to user.",
    ),
    rewards_to_org: UUID
    | None = Query(
        default=None,
        description="Search rewards to organization.",
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[Reward]:
    if not pledges_to_organization and not rewards_to_user and not rewards_to_org:
        raise HTTPException(
            status_code=401,
            detail="One of pledges_to_organization, rewards_to_user or rewards_to_org must be set",  # noqa: E501
        )

    rewards = await reward_service.list(
        session,
        pledge_org_id=pledges_to_organization,
        reward_user_id=rewards_to_user,
        reward_org_id=rewards_to_org,
    )

    items = [
        to_resource(
            pledge,
            reward,
            transaction,
            include_admin_fields=await authz.can(
                auth.subject, AccessType.write, pledge
            ),
        )
        for pledge, reward, transaction in rewards
        if await authz.can(auth.subject, AccessType.read, reward)
    ]

    return ListResource(items=items, pagination=Pagination(total_count=len(items)))


def to_resource(
    pledge: PledgeModel,
    reward: IssueReward,
    transaction: PledgeTransactionModel,
    include_admin_fields: bool,
) -> Reward:
    user = None
    if reward and reward.user:
        user = User.from_db(reward.user)
    elif reward.github_username:
        user = User(username=reward.github_username, avatar_url="x")

    organization = None
    if reward.organization:
        organization = OrganizationSchema.from_db(reward.organization)

    amount = CurrencyAmount(currency="USD", amount=0)
    if transaction and transaction.amount:
        amount = CurrencyAmount(currency="USD", amount=transaction.amount)
    else:
        amount = CurrencyAmount(
            currency="USD",
            amount=round(pledge.amount * 0.9 * reward.share_thousands / 1000),
        )

    return Reward(
        pledge=Pledge.from_db(
            pledge,
            include_admin_fields,
        ),
        user=user,
        organization=organization,
        amount=amount,
        state=RewardState.paid if transaction else RewardState.pending,
        paid_at=transaction.created_at if transaction else None,
    )
