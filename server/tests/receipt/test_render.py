import asyncio
import datetime
import multiprocessing

import anyio
import pytest

from polar.invoice.generator import InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.receipt.generator import Receipt, ReceiptRefund
from polar.receipt.render import (
    ReceiptRenderError,
    ReceiptRenderRequest,
    render_receipt_pdf,
)


@pytest.fixture
def receipt() -> Receipt:
    return Receipt(
        number="RCPT-AB1-0001",
        date=datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.UTC),
        seller_name="Polar Software Inc",
        seller_address=Address(
            line1="123 Polar St",
            city="San Francisco",
            state="CA",
            postal_code="94107",
            country=CountryAlpha2("US"),
        ),
        customer_name="John Doe",
        customer_address=Address(
            line1="456 Customer Ave",
            city="Los Angeles",
            state="CA",
            postal_code="90001",
            country=CountryAlpha2("US"),
        ),
        subtotal_amount=100_00,
        discount_amount=0,
        tax_amount=0,
        tax_breakdown=[],
        net_amount=100_00,
        currency="usd",
        items=[
            InvoiceItem(
                description="SaaS Subscription",
                quantity=1,
                unit_amount=100_00,
                amount=100_00,
            )
        ],
        refunds=[
            ReceiptRefund(
                date=datetime.datetime(2025, 2, 1, 0, 0, 0, tzinfo=datetime.UTC),
                amount=5000,
                tax_amount=0,
            )
        ],
        rendered_at=datetime.datetime(2025, 2, 1, 0, 0, 0, tzinfo=datetime.UTC),
    )


@pytest.mark.asyncio
class TestRenderReceiptPDF:
    async def test_concurrent_renders(self, receipt: Receipt) -> None:
        pdfs = await asyncio.gather(
            *(
                render_receipt_pdf(receipt.model_copy(update={"number": f"RCPT-{i}"}))
                for i in range(3)
            )
        )

        assert all(pdf.startswith(b"%PDF") for pdf in pdfs)
        assert len(set(pdfs)) == 3
        assert not multiprocessing.active_children()

    async def test_renderer_error(
        self, receipt: Receipt, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(ReceiptRenderRequest, "model_dump_json", lambda self: "{}")

        with pytest.raises(ReceiptRenderError, match="Receipt renderer failed:"):
            await render_receipt_pdf(receipt)

        assert not multiprocessing.active_children()

    async def test_timeout_kills_renderer(
        self, receipt: Receipt, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("polar.receipt.render.RENDER_TIMEOUT_SECONDS", 0.001)

        with pytest.raises(ReceiptRenderError, match="timed out"):
            await render_receipt_pdf(receipt)

        assert not multiprocessing.active_children()

    async def test_cancellation_kills_renderer(self, receipt: Receipt) -> None:
        with anyio.move_on_after(0.001) as scope:
            await render_receipt_pdf(receipt)

        assert scope.cancel_called
        assert not multiprocessing.active_children()

        pdf = await render_receipt_pdf(receipt)
        assert pdf.startswith(b"%PDF")
