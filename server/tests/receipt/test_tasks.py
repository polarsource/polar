import uuid

import pytest
from pytest_mock import MockerFixture

from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.locker import TimeoutLockError
from polar.models import Account
from polar.receipt.service import receipt as receipt_service
from polar.receipt.tasks import ReceiptOrderDoesNotExist, receipt_render
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_organization,
    create_payment,
)


def _patch_locker(mocker: MockerFixture, *, raises_timeout: bool = False) -> None:
    cm = mocker.MagicMock()
    cm.__aenter__ = mocker.AsyncMock(
        side_effect=TimeoutLockError() if raises_timeout else None
    )
    cm.__aexit__ = mocker.AsyncMock(return_value=None)
    locker = mocker.MagicMock()
    locker.lock = mocker.MagicMock(return_value=cm)
    mocker.patch("polar.receipt.tasks.Locker", return_value=locker)
    mocker.patch("polar.receipt.tasks.RedisMiddleware.get")


@pytest.mark.asyncio
class TestReceiptRender:
    async def test_raises_when_order_missing(self, mocker: MockerFixture) -> None:
        _patch_locker(mocker)

        with pytest.raises(ReceiptOrderDoesNotExist):
            await receipt_render(uuid.uuid4())

    async def test_re_enqueues_on_timeout_lock_error(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="rcpt-task-tle@example.com",
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_name="Buyer",
            billing_address=Address(
                line1="1 Test Way",
                city="SF",
                state="CA",
                postal_code="94104",
                country=CountryAlpha2("US"),
            ),
        )
        await create_payment(save_fixture, organization, order=order)
        await receipt_service.allocate(session, order)
        await session.flush()

        enqueue_job_mock = mocker.patch("polar.receipt.tasks.enqueue_job")
        _patch_locker(mocker, raises_timeout=True)

        await receipt_render(order.id)

        enqueue_job_mock.assert_called_once_with(
            "receipt.render", order.id, delay=5_000
        )

    async def test_delegates_to_service(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="rcpt-task-ok@example.com",
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_name="Buyer",
            billing_address=Address(
                line1="1 Test Way",
                city="SF",
                state="CA",
                postal_code="94104",
                country=CountryAlpha2("US"),
            ),
        )
        await create_payment(save_fixture, organization, order=order)
        await receipt_service.allocate(session, order)
        await session.flush()

        generate_mock = mocker.patch.object(
            receipt_service, "generate_order_receipt", new=mocker.AsyncMock()
        )
        _patch_locker(mocker)

        await receipt_render(order.id)

        generate_mock.assert_awaited_once()
