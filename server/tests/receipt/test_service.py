from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture

from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.locker import Locker
from polar.models import Account, Customer, Order
from polar.receipt.service import receipt as receipt_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_organization,
    create_payment,
    create_refund,
)

_US_ADDRESS = Address(
    line1="1 Test Way",
    city="SF",
    state="CA",
    postal_code="94104",
    country=CountryAlpha2("US"),
)


async def _allocated_order(
    save_fixture: SaveFixture,
    session: AsyncSession,
    account: Account,
    *,
    customer_email: str,
    customer_name: str | None = "Customer",
    billing_name: str | None,
    billing_address: Address | None,
) -> Order:
    organization = await create_organization(save_fixture, account)
    customer = await create_customer(
        save_fixture,
        organization=organization,
        email=customer_email,
        name=customer_name,  # type: ignore[arg-type]
    )
    order = await create_order(
        save_fixture,
        customer=customer,
        billing_name=billing_name,
        billing_address=billing_address,
    )
    await create_payment(save_fixture, organization, order=order)
    await receipt_service.allocate(session, order)
    return order


def _mock_render(mocker: MockerFixture):  # type: ignore[no-untyped-def]
    mocker.patch("polar.receipt.service.S3Service")
    return mocker.patch(
        "polar.receipt.service.render_receipt_pdf",
        return_value=b"%PDF-fake",
    )


@pytest.mark.asyncio
class TestAllocate:
    async def test_no_op_when_no_succeeded_payment(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        # No payment created.

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is None

    async def test_allocates_when_enabled_and_paid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt2@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is not None
        assert result.receipt_number.startswith(f"RCPT-{customer.short_id_str}-")
        assert result.receipt_number.endswith("0001")

        await session.refresh(customer)
        assert customer.receipt_next_number == 2

    async def test_idempotent_on_already_allocated_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="rcpt3@example.com"
        )
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        first = await receipt_service.allocate(session, order)
        first_number = first.receipt_number
        assert first_number is not None

        # Second call must be a no-op.
        second = await receipt_service.allocate(session, order)
        assert second.receipt_number == first_number

        await session.refresh(customer)
        # Counter only advanced once.
        assert customer.receipt_next_number == 2


@pytest.mark.asyncio
class TestDoRender:
    async def test_renders_and_uploads(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="render@example.com"
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_name="Render Buyer",
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
        assert order.receipt_number is not None

        render_mock = mocker.patch(
            "polar.receipt.service.render_receipt_pdf",
            return_value=b"%PDF-fake",
        )
        s3_class_mock = mocker.patch("polar.receipt.service.S3Service")
        upload_mock = s3_class_mock.return_value.upload

        key = await receipt_service._create_order_receipt(session, order)

        render_mock.assert_called_once()
        upload_mock.assert_called_once_with(
            b"%PDF-fake",
            key,
            "application/pdf",
            cache_control="private, max-age=31536000, immutable",
        )
        assert key.startswith(f"{order.organization_id}/{order.id}/")
        assert key.endswith(".pdf")

    async def test_renders_with_refunds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="ref@example.com"
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_name="Refund Buyer",
            billing_address=Address(
                line1="1 Test Way",
                city="SF",
                state="CA",
                postal_code="94104",
                country=CountryAlpha2("US"),
            ),
        )
        payment = await create_payment(save_fixture, organization, order=order)
        await receipt_service.allocate(session, order)

        await create_refund(save_fixture, order=order, payment=payment, amount=500)

        render_mock = mocker.patch(
            "polar.receipt.service.render_receipt_pdf",
            return_value=b"%PDF-fake",
        )
        mocker.patch("polar.receipt.service.S3Service")

        await receipt_service._create_order_receipt(session, order)

        render_mock.assert_called_once()
        receipt_arg = render_mock.call_args.args[0]
        assert len(receipt_arg.refunds) == 1
        assert receipt_arg.refunds[0].amount == 500

    async def test_falls_back_to_customer_name_when_billing_name_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        order = await _allocated_order(
            save_fixture,
            session,
            account,
            customer_email="fallback-name@example.com",
            customer_name="Fallback Customer",
            billing_name=None,
            billing_address=_US_ADDRESS,
        )
        render_mock = _mock_render(mocker)

        await receipt_service._create_order_receipt(session, order)

        assert render_mock.call_args.args[0].customer_name == "Fallback Customer"

    async def test_falls_back_to_customer_email_when_name_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        order = await _allocated_order(
            save_fixture,
            session,
            account,
            customer_email="fallback-email@example.com",
            customer_name=None,
            billing_name=None,
            billing_address=_US_ADDRESS,
        )
        render_mock = _mock_render(mocker)

        await receipt_service._create_order_receipt(session, order)

        assert (
            render_mock.call_args.args[0].customer_name == "fallback-email@example.com"
        )

    async def test_renders_when_billing_address_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        order = await _allocated_order(
            save_fixture,
            session,
            account,
            customer_email="no-address@example.com",
            billing_name="Buyer",
            billing_address=None,
        )
        render_mock = _mock_render(mocker)

        await receipt_service._create_order_receipt(session, order)

        receipt_arg = render_mock.call_args.args[0]
        assert receipt_arg.customer_address is None
        assert receipt_arg.customer_name == "Buyer"


@pytest.mark.asyncio
class TestGenerateOrderReceipt:
    async def test_no_op_when_no_receipt_number(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        locker: Locker,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        assert order.receipt_number is None

        create_mock = mocker.patch.object(receipt_service, "_create_order_receipt")

        result = await receipt_service.generate_order_receipt(session, locker, order)

        create_mock.assert_not_called()
        assert result.receipt_path is None

    async def test_persists_receipt_path(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        locker: Locker,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="generate@example.com"
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

        mocker.patch.object(
            receipt_service,
            "_create_order_receipt",
            new=mocker.AsyncMock(return_value="org/order/ts.pdf"),
        )

        result = await receipt_service.generate_order_receipt(session, locker, order)

        assert result.receipt_path == "org/order/ts.pdf"

    async def test_publishes_eventstream(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        locker: Locker,
        mocker: MockerFixture,
    ) -> None:
        organization = await create_organization(save_fixture, account)
        customer = await create_customer(
            save_fixture, organization=organization, email="event@example.com"
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

        mocker.patch.object(
            receipt_service,
            "_create_order_receipt",
            new=mocker.AsyncMock(return_value="org/order/ts.pdf"),
        )
        publish_mock = mocker.patch(
            "polar.receipt.service.eventstream_publish",
            new=mocker.AsyncMock(),
        )

        await receipt_service.generate_order_receipt(session, locker, order)

        publish_mock.assert_awaited_once_with(
            "order.receipt_generated",
            {"order_id": order.id},
            customer_id=customer.id,
            organization_id=organization.id,
        )


@pytest.mark.asyncio
class TestGetPdfUrlOrStatus:
    async def test_enqueues_render_when_path_missing(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        order.receipt_number = "RCPT-FOO-0001"
        await save_fixture(order)

        enqueue_mock = mocker.patch("polar.receipt.service.enqueue_job")

        result = await receipt_service.get_pdf_url_or_status(order)

        assert result is None
        enqueue_mock.assert_called_once_with("receipt.render", order_id=order.id)

    async def test_returns_url_when_path_set(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        order.receipt_number = "RCPT-FOO-0001"
        order.receipt_path = f"{order.organization_id}/{order.id}/receipt.pdf"
        await save_fixture(order)

        s3_mock = mocker.patch("polar.receipt.service.S3Service")
        expires_at = datetime(2030, 1, 1, tzinfo=UTC)
        s3_mock.return_value.generate_presigned_download_url.return_value = (
            "https://example.com/signed-url",
            expires_at,
        )

        result = await receipt_service.get_pdf_url_or_status(order)

        assert result == ("https://example.com/signed-url", expires_at)
        s3_mock.return_value.generate_presigned_download_url.assert_called_once_with(
            path=order.receipt_path,
            filename=order.receipt_filename,
            mime_type="application/pdf",
        )
