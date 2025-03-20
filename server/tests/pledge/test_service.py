import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType, Platforms
from polar.exceptions import NotPermitted
from polar.issue.schemas import ConfirmIssueSplit
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.pledge_transaction import PledgeTransaction, PledgeTransactionType
from polar.models.repository import Repository
from polar.models.transaction import Transaction
from polar.models.user import OAuthAccount, User
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_external_organization,
    create_issue,
    create_organization,
    create_repository,
)


@dataclass
class Invoice:
    @property
    def id(self) -> str:
        return "inv_test"

    @property
    def payment_intent(self) -> str:
        return "pi_text"

    @property
    def hosted_invoice_url(self) -> str:
        return "https://polar.sh/test.html"


@pytest.mark.asyncio
async def test_mark_pending_by_issue_id(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
    user: User,
    pledging_organization: Organization,
    mocker: MockerFixture,
) -> None:
    maintainer_notif = mocker.patch(
        "polar.pledge.service.PledgeService.send_maintainer_pending_notification"
    )

    pledger_notif = mocker.patch(
        "polar.pledge.service.PledgeService.send_pledger_pending_notification"
    )

    transfer = mocker.patch(
        "polar.integrations.stripe.service_pledge.PledgeStripeService.create_user_pledge_invoice"
    )
    transfer.return_value = Invoice()

    amount = 2000
    fee = 200

    # create multiple pledges
    pledges: list[Pledge] = []
    for _ in range(4):
        pledge = Pledge(
            id=uuid.uuid4(),
            by_organization=pledging_organization,
            issue=issue_linked,
            repository_id=repository_linked.id,
            organization_id=external_organization_linked.id,
            amount=amount,
            currency="usd",
            fee=fee,
            state=PledgeState.created,
            type=PledgeType.pay_upfront,
        )
        await save_fixture(pledge)
        pledges.append(pledge)

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await save_fixture(pledges[0])

    # ... and one as of the pledges as pending (no notification should be sent!)
    pledges[1].state = PledgeState.pending
    await save_fixture(pledges[1])

    # Create a pay on completion pledge
    pledge = Pledge(
        id=uuid.uuid4(),
        user=user,
        issue=issue_linked,
        repository_id=repository_linked.id,
        organization_id=external_organization_linked.id,
        amount=amount,
        currency="usd",
        fee=fee,
        state=PledgeState.created,
        type=PledgeType.pay_on_completion,
    )
    await save_fixture(pledge)

    # then
    session.expunge_all()

    await pledge_service.mark_pending_by_issue_id(session, issue_linked.id)

    get_pledges = await pledge_service.list_by(
        session, issue_ids=[issue_linked.id], all_states=True
    )
    states = [p.state for p in get_pledges if p]

    assert states == [
        PledgeState.refunded,  # not modified
        PledgeState.pending,
        PledgeState.pending,
        PledgeState.pending,
        PledgeState.created,  # invoiced
    ]

    assert maintainer_notif.call_count == 1
    assert pledger_notif.call_count == 3

    # do it again, no notifications should be sent!
    await pledge_service.mark_pending_by_issue_id(session, issue_linked.id)
    assert maintainer_notif.call_count == 1
    assert pledger_notif.call_count == 3


@pytest.mark.asyncio
async def test_mark_pending_already_pending_no_notification(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
    user: User,
    pledging_organization: Organization,
    mocker: MockerFixture,
) -> None:
    maintainer_notif = mocker.patch(
        "polar.pledge.service.PledgeService.send_maintainer_pending_notification"
    )

    pledger_notif = mocker.patch(
        "polar.pledge.service.PledgeService.send_pledger_pending_notification"
    )

    transfer = mocker.patch(
        "polar.integrations.stripe.service_pledge.PledgeStripeService.create_pledge_invoice"
    )
    transfer.return_value = Invoice()

    amount = 2000
    fee = 200

    # create multiple pledges
    pledges: list[Pledge] = []
    for x in range(2):
        pledge = Pledge(
            by_organization=pledging_organization,
            issue=issue_linked,
            repository_id=repository_linked.id,
            organization_id=external_organization_linked.id,
            amount=amount,
            currency="usd",
            fee=fee,
            state=PledgeState.pending,
            type=PledgeType.pay_upfront,
        )
        await save_fixture(pledge)
        pledges.append(pledge)

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await save_fixture(pledges[0])

    # then
    session.expunge_all()

    await pledge_service.mark_pending_by_issue_id(session, issue_linked.id)

    get_pledges = await pledge_service.list_by(
        session, issue_ids=[issue_linked.id], all_states=True
    )
    states = [p.state for p in get_pledges if p]

    assert states == [
        PledgeState.refunded,  # not modified
        PledgeState.pending,  # not modified
    ]

    assert maintainer_notif.call_count == 0
    assert pledger_notif.call_count == 0

    # do it again, no notifications should be sent!
    await pledge_service.mark_pending_by_issue_id(session, issue_linked.id)
    assert maintainer_notif.call_count == 0
    assert pledger_notif.call_count == 0


@pytest.mark.asyncio
async def test_transfer_unexpected_state(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    pledge_linked: Pledge,
    mocker: MockerFixture,
) -> None:
    reward = IssueReward(
        issue_id=pledge_linked.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    # then
    session.expunge_all()

    with pytest.raises(Exception, match="Pledge is not in pending state") as excinfo:
        await pledge_service.transfer(
            session, pledge_linked.id, issue_reward_id=reward.id
        )


@pytest.mark.asyncio
async def test_transfer_early(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    pledge_linked: Pledge,
    mocker: MockerFixture,
) -> None:
    await pledge_service.mark_pending_by_issue_id(session, pledge_linked.issue_id)

    reward = IssueReward(
        issue_id=pledge_linked.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    # then
    session.expunge_all()

    with pytest.raises(
        Exception,
        match=re.escape("Pledge is not ready for payput (still in dispute window)"),
    ) as excinfo:
        await pledge_service.transfer(
            session, pledge_linked.id, issue_reward_id=reward.id
        )


@pytest.mark.asyncio
async def test_transfer_org(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    organization: Organization,
    user: User,
    mocker: MockerFixture,
) -> None:
    # then
    session.expunge_all()

    paid_notification = mocker.patch(
        "polar.pledge.service.PledgeService.transfer_created_notification"
    )
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

    reward = IssueReward(
        issue_id=pledge.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    balance = mocker.patch(
        "polar.transaction.service.balance.BalanceTransactionService.create_balance_from_payment_intent"
    )
    platform_fee = mocker.patch(
        "polar.transaction.service.platform_fee.PlatformFeeTransactionService.create_fees_reversal_balances"
    )

    # then
    session.expunge_all()

    await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    balance.assert_called_once()
    platform_fee.assert_called_once()

    after_transfer = await pledge_service.get(session, pledge.id)
    assert after_transfer is not None

    paid_notification.assert_called_once()


@pytest.mark.asyncio
async def test_transfer_org_no_account(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    organization: Organization,
    mocker: MockerFixture,
) -> None:
    paid_notification = mocker.patch(
        "polar.pledge.service.PledgeService.transfer_created_notification"
    )

    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await save_fixture(got)

    reward = IssueReward(
        issue_id=pledge.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    balance = mocker.patch(
        "polar.transaction.service.balance.BalanceTransactionService.create_balance_from_payment_intent"
    )
    balance.return_value = (
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
    )

    # then
    session.expunge_all()

    with pytest.raises(NotPermitted, match="Receiving organization has no account"):
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    balance.assert_not_called()
    paid_notification.assert_not_called()


@pytest.mark.asyncio
async def test_transfer_user(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    user: User,
    mocker: MockerFixture,
) -> None:
    paid_notification = mocker.patch(
        "polar.pledge.service.PledgeService.transfer_created_notification"
    )

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
        business_type="individual",
        country="SE",
        currency="USD",
    )
    user.account = account
    await save_fixture(account)
    await save_fixture(user)

    reward = IssueReward(
        issue_id=pledge.issue_id,
        user_id=user.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    balance = mocker.patch(
        "polar.transaction.service.balance.BalanceTransactionService.create_balance_from_payment_intent"
    )
    platform_fee = mocker.patch(
        "polar.transaction.service.platform_fee.PlatformFeeTransactionService.create_fees_reversal_balances"
    )

    # then
    session.expunge_all()

    await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    balance.assert_called_once()
    platform_fee.assert_called_once()

    after_transfer = await pledge_service.get(session, pledge.id)
    assert after_transfer is not None

    paid_notification.assert_called_once()


@pytest.mark.asyncio
async def test_transfer_user_no_account(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    user: User,
    mocker: MockerFixture,
) -> None:
    paid_notification = mocker.patch(
        "polar.pledge.service.PledgeService.transfer_created_notification"
    )

    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    got.scheduled_payout_at = utc_now() - timedelta(days=2)
    got.payment_id = "test_transfer_payment_id"
    await save_fixture(got)

    reward = IssueReward(
        issue_id=pledge.issue_id,
        user_id=user.id,
        share_thousands=1000,
    )
    await save_fixture(reward)

    balance = mocker.patch(
        "polar.transaction.service.balance.BalanceTransactionService.create_balance_from_payment_intent"
    )
    balance.return_value = (
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
        Transaction(transfer_id="STRIPE_TRANSFER_ID"),
    )

    # then
    session.expunge_all()

    with pytest.raises(NotPermitted, match="Receiving user has no account"):
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    balance.assert_not_called()
    paid_notification.assert_not_called()


@pytest.mark.asyncio
async def test_validate_splits() -> None:
    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(share_thousands=1000, organization_id=uuid.uuid4())
            ]
        )
        is True
    )

    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(share_thousands=500, organization_id=uuid.uuid4()),
                ConfirmIssueSplit(share_thousands=500, organization_id=uuid.uuid4()),
            ]
        )
        is True
    )

    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(share_thousands=500, organization_id=uuid.uuid4()),
                ConfirmIssueSplit(share_thousands=400, organization_id=uuid.uuid4()),
            ]
        )
        is False
    )

    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(share_thousands=1000, organization_id=uuid.uuid4()),
                ConfirmIssueSplit(share_thousands=1000, organization_id=uuid.uuid4()),
                ConfirmIssueSplit(share_thousands=1000, organization_id=uuid.uuid4()),
            ]
        )
        is False
    )

    assert (
        pledge_service.validate_splits(
            splits=[ConfirmIssueSplit(share_thousands=1000, github_username="zegl")]
        )
        is True
    )

    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(
                    share_thousands=1000,
                    github_username="zegl",
                    organization_id=uuid.uuid4(),
                )
            ]
        )
        is False
    )

    assert (
        pledge_service.validate_splits(
            splits=[
                ConfirmIssueSplit(
                    share_thousands=1000,
                )
            ]
        )
        is False
    )


@pytest.mark.asyncio
async def test_create_issue_rewards(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
) -> None:
    # then
    session.expunge_all()

    await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
            ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
        ],
    )


@pytest.mark.asyncio
async def test_create_issue_rewards_associate_username(
    session: AsyncSession,
    save_fixture: SaveFixture,
    pledge: Pledge,
    organization: Organization,
) -> None:
    # create user and github auth
    user = User(email="test_gh_user@polar.sh")
    await save_fixture(user)
    oauth = OAuthAccount(
        platform=Platforms.github,
        user_id=user.id,
        access_token="access_token",
        account_id="1337",
        account_email="test_gh_user@polar.sh",
        account_username="test_gh_user",
    )
    await save_fixture(oauth)

    # then
    session.expunge_all()

    rewards = await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="test_gh_user"),
            ConfirmIssueSplit(share_thousands=100, github_username="unknown_user"),
            ConfirmIssueSplit(share_thousands=600, organization_id=organization.id),
        ],
    )

    assert rewards[0].user_id == user.id
    assert rewards[0].github_username == "test_gh_user"

    assert rewards[1].user_id is None
    assert rewards[1].github_username == "unknown_user"

    assert rewards[2].organization_id == organization.id


@pytest.mark.asyncio
async def test_create_issue_rewards_invalid(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
) -> None:
    # then
    session.expunge_all()

    with pytest.raises(Exception, match="invalid split configuration"):
        await pledge_service.create_issue_rewards(
            session,
            pledge.issue_id,
            splits=[
                ConfirmIssueSplit(share_thousands=700, github_username="zegl"),
                ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
            ],
        )


@pytest.mark.asyncio
async def test_create_issue_rewards_twice_fails(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
) -> None:
    # then
    session.expunge_all()

    await pledge_service.create_issue_rewards(
        session,
        pledge.issue_id,
        splits=[
            ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
            ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
        ],
    )

    with pytest.raises(Exception, match=r"issue already has splits set: .*"):
        await pledge_service.create_issue_rewards(
            session,
            pledge.issue_id,
            splits=[
                ConfirmIssueSplit(share_thousands=300, github_username="zegl"),
                ConfirmIssueSplit(share_thousands=700, organization_id=organization.id),
            ],
        )


# TODO(zegl): what does this test actually test? remove it?
@pytest.mark.asyncio
async def test_generate_pledge_testdata(
    session: AsyncSession,
    save_fixture: SaveFixture,
    user: User,
    # pledge: Pledge,
    organization: Organization,
) -> None:
    external_org = await create_external_organization(save_fixture)
    repo = await create_repository(save_fixture, external_org)
    issues = [
        await create_issue(save_fixture, external_org, repository=repo)
        for _ in range(1, 5)
    ]

    pledging_org = await create_organization(save_fixture)

    # create pledges to each issue
    # for issue in issues:
    # for amount in [2000, 2500]:
    # amount = secrets.randbelow(100000) + 1
    # fee = round(amount * 0.05)
    pledges: list[list[Pledge]] = []
    for issue in issues:
        p1 = Pledge(
            # by_organization_id=pledging_organization.id,
            issue=issue,
            repository_id=issue.repository_id,
            organization_id=external_org.id,
            amount=2000,
            currency="usd",
            fee=0,
            state=PledgeState.created,
            email="pledger@example.com",
        )
        await save_fixture(p1)
        p2 = Pledge(
            by_organization=pledging_org,
            issue=issue,
            repository_id=issue.repository_id,
            organization_id=external_org.id,
            amount=2500,
            currency="usd",
            fee=500,
            state=PledgeState.created,
            # email="pledger@example.com",
        )
        await save_fixture(p2)
        pledges.append([p1, p2])

    for p in pledges[0]:
        p.state = PledgeState.pending
        await save_fixture(p)

    reward1 = IssueReward(
        issue_id=pledges[0][0].issue_id,
        organization_id=organization.id,
        share_thousands=800,
    )
    await save_fixture(reward1)

    reward2 = IssueReward(
        issue_id=pledges[0][0].issue_id,
        github_username="zegl",
        share_thousands=200,
    )
    await save_fixture(reward2)

    for p in pledges[1]:
        p.state = PledgeState.pending
        await save_fixture(p)

    reward1 = IssueReward(
        issue_id=pledges[1][0].issue_id,
        organization_id=organization.id,
        share_thousands=800,
    )
    await save_fixture(reward1)

    reward = IssueReward(
        issue_id=pledges[1][0].issue_id,
        github_username="zegl",
        share_thousands=200,  # 20%
    )
    await save_fixture(reward)

    pledge_transaction = PledgeTransaction(
        pledge_id=pledges[1][0].id,
        type=PledgeTransactionType.transfer,
        amount=5000,  # ?
        transaction_id="text_123",
        issue_reward_id=reward.id,
    )
    await save_fixture(pledge_transaction)

    pledges[3][0].state = PledgeState.disputed
    pledges[3][0].dispute_reason = "I've been fooled."
    pledges[3][0].disputed_at = utc_now()
    pledges[3][0].disputed_by_user_id = user.id
    pledges[3][1].state = PledgeState.charge_disputed

    # then?
    session.expunge_all()


@pytest.mark.asyncio
async def test_sum_pledges_period(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
    user: User,
) -> None:
    p1 = Pledge(
        issue=issue_linked,
        repository_id=repository_linked.id,
        organization_id=external_organization_linked.id,
        amount=12300,
        currency="usd",
        fee=123,
        by_organization=organization,
        state=PledgeState.created,
        created_at=utc_now(),
    )
    await save_fixture(p1)

    p2 = Pledge(
        issue=issue_linked,
        repository_id=repository_linked.id,
        organization_id=external_organization_linked.id,
        amount=800,
        currency="usd",
        fee=123,
        by_organization=organization,
        state=PledgeState.created,
        created_at=utc_now(),
        created_by_user=user,
    )
    await save_fixture(p2)

    p3 = Pledge(
        issue=issue_linked,
        repository_id=repository_linked.id,
        organization_id=external_organization_linked.id,
        amount=800,
        currency="usd",
        fee=123,
        by_organization=organization,
        state=PledgeState.created,
        created_at=utc_now() + timedelta(days=60),  # not in current period
    )
    await save_fixture(p3)

    # then
    session.expunge_all()

    period_sum = await pledge_service.sum_pledges_period(
        session, organization_id=organization.id
    )

    assert period_sum == 12300 + 800

    period_sum_user = await pledge_service.sum_pledges_period(
        session, organization_id=organization.id, user_id=user.id
    )

    assert period_sum_user == 800


@pytest.mark.asyncio
async def test_month_range() -> None:
    # 31 day month
    assert pledge_service.month_range(
        datetime(year=2023, month=10, day=26, hour=3, minute=2)
    ) == (
        datetime(year=2023, month=10, day=1, hour=0, minute=0),
        datetime(year=2023, month=10, day=31, hour=23, minute=59, second=59),
    )

    # 30 day month
    assert pledge_service.month_range(
        datetime(year=2023, month=9, day=26, hour=3, minute=2)
    ) == (
        datetime(year=2023, month=9, day=1, hour=0, minute=0),
        datetime(year=2023, month=9, day=30, hour=23, minute=59, second=59),
    )

    # february
    assert pledge_service.month_range(
        datetime(year=2023, month=2, day=3, hour=3, minute=2)
    ) == (
        datetime(year=2023, month=2, day=1, hour=0, minute=0),
        datetime(year=2023, month=2, day=28, hour=23, minute=59, second=59),
    )

    # first month of year
    assert pledge_service.month_range(
        datetime(year=2023, month=1, day=3, hour=3, minute=2)
    ) == (
        datetime(year=2023, month=1, day=1, hour=0, minute=0),
        datetime(year=2023, month=1, day=31, hour=23, minute=59, second=59),
    )

    # last month of year
    assert pledge_service.month_range(
        datetime(year=2023, month=12, day=3, hour=3, minute=2)
    ) == (
        datetime(year=2023, month=12, day=1, hour=0, minute=0),
        datetime(year=2023, month=12, day=31, hour=23, minute=59, second=59),
    )

    # leap year
    assert pledge_service.month_range(
        datetime(year=2024, month=1, day=31, hour=3, minute=2)
    ) == (
        datetime(year=2024, month=1, day=1, hour=0, minute=0),
        datetime(year=2024, month=1, day=31, hour=23, minute=59, second=59),
    )

    # leap year
    assert pledge_service.month_range(
        datetime(year=2024, month=2, day=3, hour=3, minute=2)
    ) == (
        datetime(year=2024, month=2, day=1, hour=0, minute=0),
        datetime(year=2024, month=2, day=29, hour=23, minute=59, second=59),
    )

    # ts is at year split
    assert pledge_service.month_range(
        datetime(year=2024, month=1, day=1, hour=0, minute=0)
    ) == (
        datetime(year=2024, month=1, day=1, hour=0, minute=0),
        datetime(year=2024, month=1, day=31, hour=23, minute=59, second=59),
    )
