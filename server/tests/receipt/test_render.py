import datetime
import subprocess
import sys

import anyio
import pytest

from polar.invoice.generator import InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.receipt.generator import Receipt, ReceiptRefund
from polar.receipt.render import (
    SERVER_DIRECTORY,
    ReceiptRenderError,
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
async def test_render_receipt_pdf(receipt: Receipt) -> None:
    pdf = await render_receipt_pdf(receipt)

    assert pdf.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_render_receipt_pdf_raises_on_subprocess_failure(
    receipt: Receipt, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def run_process(
        command: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[bytes]:
        assert command == [sys.executable, "-m", "polar.receipt.render"]
        assert kwargs["input"]
        assert kwargs["check"] is False
        assert kwargs["cwd"] == SERVER_DIRECTORY
        return subprocess.CompletedProcess(command, 1, stdout=b"", stderr=b"boom")

    monkeypatch.setattr("polar.receipt.render.anyio.run_process", run_process)

    with pytest.raises(ReceiptRenderError, match="Receipt renderer failed: boom"):
        await render_receipt_pdf(receipt)


@pytest.mark.asyncio
async def test_render_receipt_pdf_timeout(
    receipt: Receipt, monkeypatch: pytest.MonkeyPatch
) -> None:
    cancelled = False

    async def run_process(
        command: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[bytes]:
        nonlocal cancelled
        try:
            await anyio.sleep_forever()
            raise AssertionError("unreachable")
        finally:
            cancelled = True

    monkeypatch.setattr("polar.receipt.render.anyio.run_process", run_process)
    monkeypatch.setattr("polar.receipt.render.RENDER_TIMEOUT_SECONDS", 0.1)

    with pytest.raises(ReceiptRenderError, match="timed out"):
        await render_receipt_pdf(receipt)

    assert cancelled
