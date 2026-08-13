import contextlib
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.dispute.dispute_case import DISPUTE_GREETING
from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.dispute.tasks import auto_accept, enqueue_auto_accepts, post_dispute_greeting
from polar.kit.utils import utc_now
from polar.models import Customer, Dispute, Organization, Product
from polar.models.dispute import DisputeStatus
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseMessageRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_dispute_case,
    create_order,
    create_payment,
)

_post_dispute_greeting = post_dispute_greeting.__wrapped__  # type: ignore[attr-defined]
_enqueue_auto_accepts = enqueue_auto_accepts.__wrapped__  # type: ignore[attr-defined]
_auto_accept = auto_accept.__wrapped__  # type: ignore[attr-defined]


async def _dispute(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
    *,
    announced_at: datetime | None = None,
    processor_id: str = "STRIPE_DISPUTE_ID",
) -> Dispute:
    order = await create_order(save_fixture, customer=customer, product=product)
    payment = await create_payment(save_fixture, organization, order=order)
    dispute = await create_dispute(
        save_fixture, order, payment, payment_processor_id=processor_id
    )
    case = DisputeSupportCase(dispute=dispute, organization=organization)
    await save_fixture(case)
    if announced_at is not None:
        message = SupportCaseMessage(
            case=case,
            type=SupportCaseMessageType.dispute_auto_accept_scheduled,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
            created_at=announced_at,
        )
        await save_fixture(message)
    return dispute


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.asyncio
class TestPostDisputeGreeting:
    async def test_posts_greeting(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _post_dispute_greeting(case.id)
        await session.flush()

        messages = await SupportCaseMessageRepository.from_session(
            session
        ).list_by_case(case.id, visible_to=None)
        greetings = [
            message for message in messages if message.body == DISPUTE_GREETING
        ]
        assert len(greetings) == 1
        assert greetings[0].author_kind == SupportCaseMessageAuthorKind.system

    async def test_idempotent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _post_dispute_greeting(case.id)
        await _post_dispute_greeting(case.id)
        await session.flush()

        messages = await SupportCaseMessageRepository.from_session(
            session
        ).list_by_case(case.id, visible_to=None)
        greetings = [
            message for message in messages if message.body == DISPUTE_GREETING
        ]
        assert len(greetings) == 1


@pytest.mark.asyncio
class TestEnqueueAutoAccepts:
    async def test_enqueues_only_aged_opted_in_disputes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        organization.feature_settings = {
            "disputes_enabled": True,
            "dispute_auto_accept_enabled": True,
        }
        organization.dispute_settings = {"auto_accept_below_amount": 2500}
        await save_fixture(organization)

        aged = await _dispute(
            save_fixture,
            organization,
            customer,
            product,
            announced_at=utc_now() - timedelta(hours=48),
        )
        await _dispute(
            save_fixture, organization, customer, product, processor_id="STRIPE_FRESH"
        )

        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        enqueue_mock = mocker.patch("polar.dispute.tasks.enqueue_job")

        await _enqueue_auto_accepts()

        enqueue_mock.assert_called_once_with("dispute.auto_accept", aged.id)

    async def test_skips_organizations_without_a_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        organization.feature_settings = {
            "disputes_enabled": True,
            "dispute_auto_accept_enabled": True,
        }
        organization.dispute_settings = {"auto_accept_below_amount": None}
        await save_fixture(organization)
        await _dispute(
            save_fixture,
            organization,
            customer,
            product,
            announced_at=utc_now() - timedelta(hours=48),
        )

        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        enqueue_mock = mocker.patch("polar.dispute.tasks.enqueue_job")

        await _enqueue_auto_accepts()

        enqueue_mock.assert_not_called()

    async def test_skips_disputes_never_announced(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        organization.feature_settings = {
            "disputes_enabled": True,
            "dispute_auto_accept_enabled": True,
        }
        organization.dispute_settings = {"auto_accept_below_amount": 2500}
        await save_fixture(organization)
        await _dispute(save_fixture, organization, customer, product)

        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        enqueue_mock = mocker.patch("polar.dispute.tasks.enqueue_job")

        await _enqueue_auto_accepts()

        enqueue_mock.assert_not_called()


@pytest.mark.asyncio
class TestAutoAccept:
    async def test_noop_when_no_longer_eligible(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        dispute = await _dispute(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        accept_mock = mocker.patch(
            "polar.dispute.tasks.dispute_service.accept", new_callable=AsyncMock
        )

        await _auto_accept(dispute.id)

        accept_mock.assert_not_awaited()

    async def test_does_not_accept_after_concurrent_merchant_reply(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        """The re-check inside ``accept()`` must catch a merchant reply that
        committed after the sweep's ``auto_accept_applies()`` check ran."""
        dispute = await _dispute(save_fixture, organization, customer, product)
        case = await dispute_case_service.get_case(session, dispute)
        assert case is not None
        await save_fixture(
            SupportCaseMessage(
                case=case,
                type=SupportCaseMessageType.chat,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                body="We're handling this ourselves.",
                audience=[SupportCaseAudience.merchant],
            )
        )

        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        mocker.patch(
            "polar.dispute.tasks.dispute_service.auto_accept_applies",
            new_callable=AsyncMock,
            return_value=True,
        )
        close_mock = mocker.patch("polar.dispute.service.stripe_service.close_dispute")

        await _auto_accept(dispute.id)

        close_mock.assert_not_awaited()
        await session.refresh(dispute)
        assert dispute.status == DisputeStatus.needs_response
        message_types = [
            message.type
            for message in await SupportCaseMessageRepository.from_session(
                session
            ).list_by_case(case.id, visible_to=None)
        ]
        assert SupportCaseMessageType.dispute_auto_accepted not in message_types
