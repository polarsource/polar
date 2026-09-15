import asyncio
import datetime
import multiprocessing
from io import BytesIO

import anyio
import pytest
from pypdf import PdfReader

from polar.invoice.generator import Invoice, InvoiceItem
from polar.invoice.render import (
    InvoiceRenderError,
    InvoiceRenderRequest,
    render_invoice_pdf,
)
from polar.kit.address import Address, CountryAlpha2
from polar.receipt.generator import Receipt
from polar.receipt.render import render_receipt_pdf


@pytest.fixture
def invoice() -> Invoice:
    return Invoice(
        number="12345",
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
    )


@pytest.mark.asyncio
class TestRenderInvoicePDF:
    async def test_concurrent_document_types(self, invoice: Invoice) -> None:
        pdfs = await asyncio.gather(
            render_invoice_pdf(invoice),
            render_invoice_pdf(invoice, heading_title="Reverse Invoice"),
            render_receipt_pdf(Receipt.model_validate(invoice.model_dump())),
        )

        for pdf, heading in zip(pdfs, ("Invoice", "Reverse Invoice", "Receipt")):
            text = PdfReader(BytesIO(pdf)).pages[0].extract_text()
            assert text.splitlines()[0] == heading
            assert invoice.customer_name in text
        assert not multiprocessing.active_children()

    async def test_renderer_error(
        self, invoice: Invoice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(InvoiceRenderRequest, "model_dump_json", lambda self: "{}")

        with pytest.raises(InvoiceRenderError, match="Invoice renderer failed:"):
            await render_invoice_pdf(invoice)

        assert not multiprocessing.active_children()

    async def test_cancellation_kills_renderer(self, invoice: Invoice) -> None:
        with anyio.move_on_after(0.001) as scope:
            await render_invoice_pdf(invoice)

        assert scope.cancel_called
        assert not multiprocessing.active_children()

        pdf = await render_invoice_pdf(invoice)
        assert pdf.startswith(b"%PDF")
