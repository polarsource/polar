import uuid
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType, Platforms
from polar.issue.schemas import ConfirmIssueSplit
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState
from polar.models.repository import Repository
from polar.models.user import OAuthAccount, User
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.reward.endpoints import to_resource
from polar.reward.service import reward_service
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_list_rewards(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    organization: Organization,
    user: User,
    mocker: MockerFixture,
) -> None:
    # then
    session.expunge_all()

    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await save_fixture(got)

    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="company",
        country="SE",
        currency="USD",
    )

    # the session has been flushed, "organization" is no longer mutable
    org = await organization_service.get(session, organization.id)
    assert org
    org.account = account

    await save_fixture(account)
    await save_fixture(org)

    splits = await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
            ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
        ],
    )

    rewards = await reward_service.list(session, pledge_org_id=organization.id)
    assert len(rewards) == 2

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
    balance = mocker.patch(
        "polar.transaction.service.balance.BalanceTransactionService.create_balance_from_payment_intent"
    )
    platform_fee = mocker.patch(
        "polar.transaction.service.platform_fee.PlatformFeeTransactionService.create_fees_reversal_balances"
    )

    await pledge_service.transfer(session, pledge.id, issue_reward_id=org_tuple[1].id)

    balance.assert_called_once()
    platform_fee.assert_called_once()

    # assert rewards after transfer
    rewards = await reward_service.list(session, pledge_org_id=organization.id)
    assert len(rewards) == 2

    org_tuple = [r for r in rewards if r[1].organization_id == organization.id][0]
    assert org_tuple[0].id == pledge.id
    assert org_tuple[1].github_username is None
    assert org_tuple[1].organization_id is organization.id
    assert org_tuple[1].share_thousands == 700
    assert org_tuple[2].amount == round(pledge.amount * 0.7)


@pytest.mark.asyncio
async def test_list_rewards_to_user(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    pledging_organization: Organization,
    issue: Issue,
    repository: Repository,
    user: User,
) -> None:
    oauth = OAuthAccount(
        platform=Platforms.github,
        user_id=user.id,
        access_token="access_token",
        account_id="1337",
        account_email="test_gh_user@polar.sh",
        account_username="test_gh_user",
    )
    await save_fixture(oauth)

    # create two pledges
    pledge_1 = Pledge(
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=1000,
        fee=0,
        state=PledgeState.created,
        scheduled_payout_at=utc_now() - timedelta(days=2),
        payment_id="test_transfer_payment_id",
    )
    await save_fixture(pledge_1)

    pledge_2 = Pledge(
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=2000,
        fee=0,
        state=PledgeState.created,
        scheduled_payout_at=utc_now() - timedelta(days=2),
        payment_id="test_transfer_payment_id",
    )
    await save_fixture(pledge_2)

    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="individual",
        currency="SEK",
        country="SE",
    )
    user.account = account
    await save_fixture(account)
    await save_fixture(user)

    # then
    session.expunge_all()

    splits = await pledge_service.create_issue_rewards(
        session,
        issue.id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="test_gh_user"),
            ConfirmIssueSplit(share_thousands=300, github_username="other_gh_user"),
            ConfirmIssueSplit(share_thousands=400, organization_id=organization.id),
        ],
    )

    # assert rewards after transfer
    rewards = await reward_service.list(session, reward_user_id=user.id)
    assert len(rewards) == 2

    assert rewards[0][0].amount == 1000
    assert rewards[0][1].user_id == user.id

    assert rewards[1][0].amount == 2000
    assert rewards[1][1].user_id == user.id

    # test get single reward
    (f_pledge, f_issue_reward, f_pledge_tsx) = rewards[0]
    assert to_resource(f_pledge, f_issue_reward, f_pledge_tsx)

    s_single = await reward_service.get(session, f_pledge.id, f_issue_reward.id)
    assert s_single is not None
    (s_pledge, s_issue_reward, s_pledge_tsx) = s_single
    assert s_pledge.id is f_pledge.id
    assert to_resource(s_pledge, s_issue_reward, s_pledge_tsx)
