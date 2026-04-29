import datetime
import sys
from collections.abc import Mapping

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


class StubProcess:
    def __init__(self, stdout: bytes, stderr: bytes, returncode: int) -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode

    async def communicate(self, input: bytes) -> tuple[bytes, bytes]:
        self.input = input
        return self.stdout, self.stderr


@pytest.mark.asyncio
async def test_render_receipt_pdf_raises_on_subprocess_failure(
    receipt: Receipt, monkeypatch: pytest.MonkeyPatch
) -> None:
    process = StubProcess(b"", b"boom", 1)

    async def create_subprocess_exec(*args: object, **kwargs: object) -> StubProcess:
        kwargs_dict = kwargs if isinstance(kwargs, Mapping) else {}
        assert args == (sys.executable, "-m", "polar.receipt.render")
        assert kwargs_dict["cwd"] == SERVER_DIRECTORY
        return process

    monkeypatch.setattr(
        "polar.receipt.render.asyncio.create_subprocess_exec", create_subprocess_exec
    )

    with pytest.raises(ReceiptRenderError, match="Receipt renderer failed: boom"):
        await render_receipt_pdf(receipt)


class HangingProcess:
    """Simulates a subprocess that hangs forever on communicate."""

    def __init__(self) -> None:
        self.killed = False
        self.returncode: int | None = None

    async def communicate(self, input: bytes) -> tuple[bytes, bytes]:
        # Hang forever.
        import asyncio

        await asyncio.sleep(3600)
        return b"", b""

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9

    async def wait(self) -> int:
        return self.returncode or 0


@pytest.mark.asyncio
async def test_render_receipt_pdf_timeout(
    receipt: Receipt, monkeypatch: pytest.MonkeyPatch
) -> None:
    process = HangingProcess()

    async def create_subprocess_exec(*args: object, **kwargs: object) -> HangingProcess:
        return process

    monkeypatch.setattr(
        "polar.receipt.render.asyncio.create_subprocess_exec", create_subprocess_exec
    )
    monkeypatch.setattr("polar.receipt.render.RENDER_TIMEOUT_SECONDS", 0.1)
    monkeypatch.setattr("polar.receipt.render.KILL_WAIT_SECONDS", 0.1)

    with pytest.raises(ReceiptRenderError, match="timed out"):
        await render_receipt_pdf(receipt)

    assert process.killed
