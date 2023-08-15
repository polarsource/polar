from dataclasses import dataclass
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.issue.schemas import ConfirmIssueSplit
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.reward.service import reward_service


@pytest.mark.asyncio
async def test_list_rewards(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
    user: User,
    mocker: MockerFixture,
) -> None:
    await pledge_service.mark_pending_by_pledge_id(session, pledge.id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await got.save(session)

    account = await Account.create(
        session=session,
        organization_id=organization.id,
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="company",
    )
    await session.flush()
    organization.account = account
    await organization.save(session)

    splits = await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
            ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
        ],
    )

    # assert rewards
    rewards = await reward_service.list(session, org_id=organization.id)
    assert len(rewards) == 2

    for p, r, t in rewards:
        print(p, r, t)

    user_tuple = [r for r in rewards if r[1].github_username == "zegl"][0]
    assert user_tuple[0].id == pledge.id
    assert user_tuple[1].github_username == "zegl"
    assert user_tuple[1].organization_id is None
    assert user_tuple[1].share_thousands == 300
    assert user_tuple[2] is None  # no transfer

    org_tuple = [r for r in rewards if r[1].organization_id == organization.id][0]
    assert org_tuple[0].id == pledge.id
    assert org_tuple[1].github_username is None
    assert org_tuple[1].organization_id is organization.id
    assert org_tuple[1].share_thousands == 700
    assert org_tuple[2] is None  # no transfer

    # Create transfer to organization
    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    await pledge_service.transfer(session, pledge.id, issue_reward_id=org_tuple[1].id)

    transfer.assert_called_once()

    # assert rewards after transfer
    rewards = await reward_service.list(session, org_id=organization.id)
    assert len(rewards) == 2

    org_tuple = [r for r in rewards if r[1].organization_id == organization.id][0]
    assert org_tuple[0].id == pledge.id
    assert org_tuple[1].github_username is None
    assert org_tuple[1].organization_id is organization.id
    assert org_tuple[1].share_thousands == 700
    assert org_tuple[2].amount == round(pledge.amount * 0.9 * 0.7)  # hmmm
