import re
import uuid
from dataclasses import dataclass
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.pledge.schemas import PledgeState
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_mark_pending_by_pledge_id(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    pending_notif = mocker.patch("polar.receivers.pledges.pledge_pending_notification")
    paid_notif = mocker.patch("polar.receivers.pledges.pledge_paid_notification")

    await pledge_service.mark_pending_by_pledge_id(session, pledge.id)

    # get
    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    assert got.state == PledgeState.pending

    pending_notif.assert_called_once()
    paid_notif.assert_not_called()


@pytest.mark.asyncio
async def test_mark_confirmation_pending_by_issue_id(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    user: User,
    pledging_organization: Organization,
    mocker: MockerFixture,
) -> None:
    confirmation_pending_notif = mocker.patch(
        "polar.receivers.pledges.pledge_confirmation_pending_notification"
    )

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
        )
        for x in range(4)
    ]
    await session.commit()

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await pledges[0].save(session)

    await pledge_service.mark_confirmation_pending_by_issue_id(session, issue.id)

    get_pledges = [(await pledge_service.get(session, p.id)) for p in pledges]
    states = [p.state for p in get_pledges if p]

    assert states == [
        PledgeState.refunded,  # not modified
        PledgeState.confirmation_pending,
        PledgeState.confirmation_pending,
        PledgeState.confirmation_pending,
    ]

    assert confirmation_pending_notif.call_count == 3


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
    pending_notif = mocker.patch("polar.receivers.pledges.pledge_pending_notification")
    paid_notif = mocker.patch("polar.receivers.pledges.pledge_paid_notification")

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
            state=PledgeState.confirmation_pending,
        )
        for x in range(4)
    ]
    await session.commit()

    # Mark one of the pledges as refunded
    pledges[0].state = PledgeState.refunded
    await pledges[0].save(session)

    await pledge_service.mark_pending_by_issue_id(session, issue.id)

    get_pledges = [(await pledge_service.get(session, p.id)) for p in pledges]
    states = [p.state for p in get_pledges if p]

    assert states == [
        PledgeState.refunded,  # not modified
        PledgeState.pending,
        PledgeState.pending,
        PledgeState.pending,
    ]

    assert pending_notif.call_count == 3
    paid_notif.assert_not_called()


@pytest.mark.asyncio
async def test_mark_paid_by_payment_id(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch("polar.receivers.pledges.pledge_paid_notification")

    # created -> pending
    await pledge_service.mark_pending_by_pledge_id(session, pledge.id)

    # Create fake payment
    pledge.payment_id = "payment-id"
    await pledge.save(session)
    await session.commit()

    await pledge_service.mark_paid_by_payment_id(session, "payment-id", 100, "trx-id")

    # get
    got = await pledge_service.get(session, pledge.id)
    assert got is not None
    assert got.state == PledgeState.paid

    m.assert_called_once()


@pytest.mark.asyncio
async def test_mark_paid_by_payment_id_fails_unexpected_state(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch("polar.receivers.pledges.pledge_paid_notification")

    # Create fake payment
    pledge.payment_id = "payment-id-2"
    await pledge.save(session)
    await session.commit()

    with pytest.raises(
        Exception, match="pledge is in unexpected state: PledgeState.created"
    ) as excinfo:
        await pledge_service.mark_paid_by_payment_id(
            session, "payment-id-2", 100, "trx-id"
        )

    m.assert_not_called()


@pytest.mark.asyncio
async def test_transfer_unexpected_state(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    with pytest.raises(Exception, match="Pledge is not in pending state") as excinfo:
        await pledge_service.transfer(session, pledge.id)


@pytest.mark.asyncio
async def test_transfer_early(
    session: AsyncSession,
    pledge: Pledge,
    mocker: MockerFixture,
) -> None:
    await pledge_service.mark_pending_by_pledge_id(session, pledge.id)

    with pytest.raises(
        Exception,
        match=re.escape("Pledge is not ready for payput (still in dispute window)"),
    ) as excinfo:
        await pledge_service.transfer(session, pledge.id)


@pytest.mark.asyncio
async def test_transfer(
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
    # session.expire_all()
    await session.flush()
    organization.account = account
    await organization.save(session)

    @dataclass
    class Trans:
        @property
        def stripe_id(self) -> str:
            return "transfer_id"

    transfer = mocker.patch("polar.integrations.stripe.service.StripeService.transfer")
    transfer.return_value = Trans()

    await pledge_service.transfer(session, pledge.id)

    transfer.assert_called_once()

    after_transfer = await pledge_service.get(session, pledge.id)
    assert after_transfer is not None
    assert after_transfer.state is PledgeState.paid
