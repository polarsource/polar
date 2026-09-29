import contextlib
from collections.abc import AsyncIterator
from datetime import datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.checkout.repository import CheckoutRepository
from polar.checkout.tasks import anonymize_expired
from polar.kit.utils import utc_now
from polar.models import Checkout, Product
from polar.models.checkout import CheckoutStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout

_anonymize_expired = anonymize_expired.__wrapped__  # type: ignore[attr-defined]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


async def _create_checkout(
    save_fixture: SaveFixture,
    product: Product,
    *,
    status: CheckoutStatus,
    created_at: datetime,
) -> Checkout:
    checkout = await create_checkout(
        save_fixture, products=[product], status=status, created_at=created_at
    )
    checkout.customer_email = "john@example.com"
    await save_fixture(checkout)
    return checkout


@pytest.mark.asyncio
class TestAnonymizeExpired:
    async def test_scrubs_checkouts_past_retention(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
    ) -> None:
        mocker.patch(
            "polar.checkout.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        old = await _create_checkout(
            save_fixture,
            product,
            status=CheckoutStatus.expired,
            created_at=utc_now() - timedelta(days=91),
        )
        recent = await _create_checkout(
            save_fixture,
            product,
            status=CheckoutStatus.expired,
            created_at=utc_now() - timedelta(days=89),
        )

        await _anonymize_expired()

        await session.refresh(old)
        await session.refresh(recent)
        assert old.customer_email is None
        assert old.anonymized_at is not None
        assert recent.customer_email == "john@example.com"
        assert recent.anonymized_at is None

    async def test_keeps_batching_until_nothing_is_due(
        self, mocker: MockerFixture, session: AsyncSession
    ) -> None:
        mocker.patch(
            "polar.checkout.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        anonymize_expired_mock = mocker.patch.object(
            CheckoutRepository, "anonymize_expired", side_effect=[5000, 5000, 120, 0]
        )

        await _anonymize_expired()

        assert anonymize_expired_mock.await_count == 4
