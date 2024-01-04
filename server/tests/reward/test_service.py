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
from polar.models.transaction import Transaction
from polar.models.user import OAuthAccount, User
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.reward.endpoints import to_resource
from polar.reward.service import reward_service


@pytest.mark.asyncio
async def test_list_rewards(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
    user: User,
    mocker: MockerFixture,
) -> None:
    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await got.save(session)

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
    session.add(account)
    organization.account = account
    session.add(organization)
    await session.commit()

    # then
    session.expunge_all()

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
    transfer = mocker.patch(
        "polar.transaction.service.transfer.TransferTransactionService.create_transfer_from_payment_intent"
    )
    transfer.return_value = (
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
    )

    await pledge_service.transfer(session, pledge.id, issue_reward_id=org_tuple[1].id)

    transfer.assert_called_once()

    # assert rewards after transfer
    rewards = await reward_service.list(session, pledge_org_id=organization.id)
    assert len(rewards) == 2

    org_tuple = [r for r in rewards if r[1].organization_id == organization.id][0]
    assert org_tuple[0].id == pledge.id
    assert org_tuple[1].github_username is None
    assert org_tuple[1].organization_id is organization.id
    assert org_tuple[1].share_thousands == 700
    assert org_tuple[2].amount == round(pledge.amount * 0.9 * 0.7)  # hmmm


@pytest.mark.asyncio
async def test_list_rewards_to_user(
    session: AsyncSession,
    organization: Organization,
    pledging_organization: Organization,
    issue: Issue,
    repository: Repository,
    user: User,
) -> None:
    user.username = "test_gh_user"
    await user.save(session)

    oauth = await OAuthAccount(
        platform=Platforms.github,
        user_id=user.id,
        access_token="access_token",
        account_id="1337",
        account_email="test_gh_user@polar.sh",
    ).save(session)

    # create two pledges
    pledge_1 = await Pledge(
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
    ).save(session)

    pledge_2 = await Pledge(
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
    ).save(session)

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
    session.add(account)
    user.account = account
    session.add(user)
    await session.commit()

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
