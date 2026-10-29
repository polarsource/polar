import hashlib

import pytest
from pytest_mock import MockerFixture

from polar.credit_note.service import (
    CreditNoteAlreadyExists,
    CreditNoteRefundNotEligible,
    CreditNoteTaxIDMissing,
)
from polar.credit_note.service import credit_note as service
from polar.kit.address import Address, CountryAlpha2
from polar.models import Customer, Product, Refund
from polar.models.refund import RefundReason, RefundStatus
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order_and_payment, create_refund


@pytest.fixture
async def refund(
    save_fixture: SaveFixture, customer: Customer, product: Product
) -> Refund:
    order, payment, _ = await create_order_and_payment(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=10000,
        tax_amount=2000,
        billing_address=Address(country=CountryAlpha2("FR")),
    )
    order.billing_name = "Original customer"
    await save_fixture(order)
    return await create_refund(
        save_fixture, order, payment, amount=2500, tax_amount=500
    )


@pytest.mark.anyio
class TestCreateFromRefund:
    async def test_create_and_generate(
        self, session: AsyncSession, refund: Refund, mocker: MockerFixture
    ) -> None:
        note = await service.create_from_refund(session, refund)
        assert note.number == f"CN-{note.order.customer.short_id_str}-0001"
        assert (note.amount, note.tax_amount) == (2500, 500)
        assert len(note.items) == 1
        assert (note.items[0].amount, note.items[0].tax_amount) == (2500, 500)
        assert refund.credit_note_id == note.id
        with pytest.raises(CreditNoteAlreadyExists):
            await service.create_from_refund(session, refund)
        render = mocker.patch(
            "polar.credit_note.service.render_credit_note_pdf", return_value=b"pdf"
        )
        upload = mocker.patch("polar.credit_note.service.S3Service.upload")
        await service.generate_pdf(session, note)
        await service.generate_pdf(session, note)
        render.assert_awaited_once()
        upload.assert_called_once()
        assert note.checksum == hashlib.sha256(b"pdf").hexdigest()

    async def test_vat_snapshot_and_sequence(
        self, session: AsyncSession, save_fixture: SaveFixture, refund: Refund
    ) -> None:
        refund.reason = RefundReason.vat_reverse_charge_correction
        refund.amount = 0
        assert refund.order is not None
        refund.order.customer.tax_id = ("FR12345678901", TaxIDFormat.eu_vat)
        payment = refund.payment
        await save_fixture(refund)
        note = await service.create_from_refund(session, refund)
        assert note.amount == note.items[0].amount == 0
        assert note.tax_id == note.order.customer.tax_id
        assert note.order.tax_id is None
        other = await create_refund(
            save_fixture, note.order, payment, processor_id="another-refund"
        )
        second = await service.create_from_refund(session, other)
        assert second.number == f"CN-{note.order.customer.short_id_str}-0002"
        note.order.billing_name = "Changed customer"
        assert note.billing_name == "Original customer"

    @pytest.mark.parametrize(
        "status", [RefundStatus.failed, RefundStatus.canceled, RefundStatus.pending]
    )
    async def test_ineligible_refund(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        refund: Refund,
        status: RefundStatus,
    ) -> None:
        refund.status = status
        await save_fixture(refund)
        with pytest.raises(CreditNoteRefundNotEligible):
            await service.create_from_refund(session, refund)

    async def test_missing_vat_id(self, session: AsyncSession, refund: Refund) -> None:
        refund.reason = RefundReason.vat_reverse_charge_correction
        assert refund.order is not None
        refund.order.customer.tax_id = None
        with pytest.raises(CreditNoteTaxIDMissing):
            await service.create_from_refund(session, refund)

    async def test_sequence_across_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        refund: Refund,
        product: Product,
    ) -> None:
        first = await service.create_from_refund(session, refund)
        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=first.order.customer,
            subtotal_amount=10000,
            tax_amount=2000,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        order.billing_name = "Original customer"
        await save_fixture(order)
        other = await create_refund(
            save_fixture, order, payment, processor_id="another-refund"
        )
        second = await service.create_from_refund(session, other)
        assert first.order_id != second.order_id
        assert first.number == f"CN-{order.customer.short_id_str}-0001"
        assert second.number == f"CN-{order.customer.short_id_str}-0002"
