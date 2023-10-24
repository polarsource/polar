import re
import uuid
from dataclasses import dataclass
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.exceptions import NotPermitted
from polar.issue.schemas import ConfirmIssueSplit
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.models.user import OAuthAccount, User
from polar.pledge.schemas import PledgeState, PledgeTransactionType, PledgeType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import (
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
    def stripe_id(self) -> str:
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
    organization: Organization,
    repository: Repository,
    issue: Issue,
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
        "polar.integrations.stripe.service.StripeService.create_user_pledge_invoice"
    )
    transfer.return_value = Invoice()

    amount = 2000
    fee = 200

    # create multiple pledges
    pledges: list[Pledge] = [
        await Pledge.create(
            session=session,
            id=uuid.uuid4(),
            by_organization_id=pledging_organization.id,
            issue_id=issue.id,
            repository_id=repository.id,
            organization_id=organization.id,
            amount=amount,
            fee=fee,
            state=PledgeState.created,
            type=PledgeType.pay_upfront,
        )
        for x in range(4)
    ]

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await pledges[0].save(session)

    # ... and one as of the pledges as pending (no notification should be sent!)
    pledges[1].state = PledgeState.pending
    await pledges[1].save(session)

    # Create a pay on completion pledge
    await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_user_id=user.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=amount,
        fee=fee,
        state=PledgeState.created,
        type=PledgeType.pay_on_completion,
    )

    await session.commit()

    await pledge_service.mark_pending_by_issue_id(session, issue.id)

    get_pledges = await pledge_service.list_by(
        session, issue_ids=[issue.id], all_states=True
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
    await pledge_service.mark_pending_by_issue_id(session, issue.id)
    assert maintainer_notif.call_count == 1
    assert pledger_notif.call_count == 3


@pytest.mark.asyncio
async def test_mark_pending_already_pending_no_notification(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
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
        "polar.integrations.stripe.service.StripeService.create_pledge_invoice"
    )
    transfer.return_value = Invoice()

    amount = 2000
    fee = 200

    # create multiple pledges
    pledges: list[Pledge] = [
        await Pledge.create(
            session=session,
            id=uuid.uuid4(),
            by_organization_id=pledging_organization.id,
            issue_id=issue.id,
            repository_id=repository.id,
            organization_id=organization.id,
            amount=amount,
            fee=fee,
            state=PledgeState.pending,
            type=PledgeType.pay_upfront,
        )
        for x in range(2)
    ]

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await pledges[0].save(session)

    await session.commit()

    await pledge_service.mark_pending_by_issue_id(session, issue.id)

    get_pledges = await pledge_service.list_by(
        session, issue_ids=[issue.id], all_states=True
    )
    states = [p.state for p in get_pledges if p]

    assert states == [
        PledgeState.refunded,  # not modified
        PledgeState.pending,  # not modified
    ]

    assert maintainer_notif.call_count == 0
    assert pledger_notif.call_count == 0

    # do it again, no notifications should be sent!
    await pledge_service.mark_pending_by_issue_id(session, issue.id)
    assert maintainer_notif.call_count == 0
    assert pledger_notif.call_count == 0


@pytest.mark.asyncio
async def test_transfer_unexpected_state(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        organization_id=pledge.organization_id,
        share_thousands=1000,
    )

    with pytest.raises(Exception, match="Pledge is not in pending state") as excinfo:
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)


@pytest.mark.asyncio
async def test_transfer_early(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    await pledge_service.mark_pending_by_issue_id(session, pledge.issue_id)

    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        organization_id=pledge.organization_id,
        share_thousands=1000,
    )

    with pytest.raises(
        Exception,
        match=re.escape("Pledge is not ready for payput (still in dispute window)"),
    ) as excinfo:
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)


@pytest.mark.asyncio
async def test_transfer_org(
    session: AsyncSession,
    pledge: Pledge,
    organization: Organization,
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

    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )

    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    transfer.assert_called_once()

    after_transfer = await pledge_service.get(session, pledge.id)
    assert after_transfer is not None

    paid_notification.assert_called_once()


@pytest.mark.asyncio
async def test_transfer_org_no_account(
    session: AsyncSession,
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
    await got.save(session)
    await session.flush()

    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        organization_id=organization.id,
        share_thousands=1000,
    )

    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    with pytest.raises(NotPermitted, match="Receiving organization has no account"):
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    transfer.assert_not_called()
    paid_notification.assert_not_called()


@pytest.mark.asyncio
async def test_transfer_user(
    session: AsyncSession,
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
    await got.save(session)

    account = await Account.create(
        session=session,
        user_id=user.id,
        account_type=AccountType.stripe,
        admin_id=user.id,
        stripe_id="testing_account_1",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="individual",
    )
    await session.flush()

    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        user_id=user.id,
        share_thousands=1000,
    )

    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    transfer.assert_called_once()

    after_transfer = await pledge_service.get(session, pledge.id)
    assert after_transfer is not None

    paid_notification.assert_called_once()


@pytest.mark.asyncio
async def test_transfer_user_no_account(
    session: AsyncSession,
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
    await got.save(session)
    await session.flush()

    reward = await IssueReward.create(
        session,
        issue_id=pledge.issue_id,
        user_id=user.id,
        share_thousands=1000,
    )

    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    with pytest.raises(NotPermitted, match="Receiving user has no account"):
        await pledge_service.transfer(session, pledge.id, issue_reward_id=reward.id)

    transfer.assert_not_called()
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
    pledge: Pledge,
    organization: Organization,
) -> None:
    # create user and github auth
    user = await User.create(
        session=session,
        username="test_gh_user",
        email="test_gh_user@polar.sh",
    )
    oauth = await OAuthAccount.create(
        session=session,
        platform="github",
        user_id=user.id,
        access_token="access_token",
        account_id="1337",
        account_email="test_gh_user@polar.sh",
    )

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


@pytest.mark.asyncio
async def test_generate_pledge_testdata(
    session: AsyncSession,
    user: User,
    # pledge: Pledge,
    # organization: Organization,
) -> None:
    org = await create_organization(session)
    repo = await create_repository(session, organization=org)
    issues = [
        await create_issue(
            session,
            organization=org,
            repository=repo,
        )
        for _ in range(1, 5)
    ]

    pledging_org = await create_organization(session)

    # create pledges to each issue
    # for issue in issues:
    # for amount in [2000, 2500]:
    # amount = secrets.randbelow(100000) + 1
    # fee = round(amount * 0.05)
    pledges = [
        [
            await Pledge.create(
                session=session,
                id=uuid.uuid4(),
                # by_organization_id=pledging_organization.id,
                issue_id=issue.id,
                repository_id=issue.repository_id,
                organization_id=issue.organization_id,
                amount=2000,
                fee=0,
                state=PledgeState.created,
                email="pledger@example.com",
            ),
            await Pledge.create(
                session=session,
                id=uuid.uuid4(),
                by_organization_id=pledging_org.id,
                issue_id=issue.id,
                repository_id=issue.repository_id,
                organization_id=issue.organization_id,
                amount=2500,
                fee=500,
                state=PledgeState.created,
                # email="pledger@example.com",
            ),
        ]
        for issue in issues
    ]

    for p in pledges[0]:
        p.state = PledgeState.pending
    await IssueReward.create(
        session,
        issue_id=pledges[0][0].issue_id,
        organization_id=org.id,
        share_thousands=800,
    )
    await IssueReward.create(
        session,
        issue_id=pledges[0][0].issue_id,
        github_username="zegl",
        share_thousands=200,
    )

    for p in pledges[1]:
        p.state = PledgeState.pending
    await IssueReward.create(
        session,
        issue_id=pledges[1][0].issue_id,
        organization_id=org.id,
        share_thousands=800,
    )
    reward = await IssueReward.create(
        session,
        issue_id=pledges[1][0].issue_id,
        github_username="zegl",
        share_thousands=200,  # 20%
    )

    await PledgeTransaction.create(
        session,
        pledge_id=pledges[1][0].id,
        type=PledgeTransactionType.transfer,
        amount=5000,  # ?
        transaction_id="text_123",
        issue_reward_id=reward.id,
    )

    pledges[3][0].state = PledgeState.disputed
    pledges[3][0].dispute_reason = "I've been fooled."
    pledges[3][0].disputed_at = utc_now()
    pledges[3][0].disputed_by_user_id = user.id
    pledges[3][1].state = PledgeState.charge_disputed

    await session.commit()


@pytest.mark.asyncio
async def test_mark_created_by_payment_id(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:
    mocker.patch("polar.worker._enqueue_job")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-2",
    )

    assert pledge.payment_id

    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id-2",
    )

    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id-2",
    )

    got = await pledge_service.get(session, pledge.id)
    assert got
    assert got.state == PledgeState.created
