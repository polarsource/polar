import uuid
import pytest
from pytest_mock import MockerFixture
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.pledge.schemas import PledgeState

from polar.postgres import AsyncSession

from polar.pledge.service import pledge as pledge_service


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
            state=PledgeState.created,
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

    # get
    # got = await pledge_service.get(session, pledge.id)
    # assert got is not None
    # assert got.state == PledgeState.pending

    # pending_notif.assert_called_once
    # paid_notif.assert_not_called

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


# TODO: it would be nice to have a test for transfer()
