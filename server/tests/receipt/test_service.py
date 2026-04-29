import pytest
from pytest_mock import MockerFixture

from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.locker import Locker
from polar.models import Account, Customer, Organization
from polar.receipt.service import receipt as receipt_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_organization,
    create_payment,
    create_refund,
)


@pytest.mark.asyncio
class TestAllocate:
    async def test_no_op_when_flag_off(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        await create_payment(save_fixture, organization, order=order)

        result = await receipt_service.allocate(session, order)

        assert result.receipt_number is None

    async def test_no_op_when_no_succeeded_payment(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
        organization = await create_organization(
            save_fixture, account, feature_settings={"receipts_enabled": True}
        )
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
