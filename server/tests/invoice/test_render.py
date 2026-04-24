import datetime
import os
import sys
from collections.abc import Mapping

import pytest

from polar.invoice.generator import Invoice, InvoiceItem
from polar.invoice.render import (
    SERVER_DIRECTORY,
    InvoiceRenderError,
    build_invoice_renderer_env,
    render_invoice_pdf,
)
from polar.kit.address import Address, CountryAlpha2


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
async def test_render_invoice_pdf(invoice: Invoice) -> None:
    pdf = await render_invoice_pdf(invoice)

    assert pdf.startswith(b"%PDF")


def test_build_invoice_renderer_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PATH", os.environ.get("PATH", ""))
    monkeypatch.setenv("POLAR_ENV", "testing")
    monkeypatch.setenv("POLAR_CUSTOM_OVERRIDE", "1")
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "/tmp/should-not-leak")
    monkeypatch.setenv("UNRELATED_RUNTIME_VAR", "ignore-me")

    env = build_invoice_renderer_env()

    assert env["POLAR_ENV"] == "testing"
    assert env["POLAR_CUSTOM_OVERRIDE"] == "1"
    assert "PATH" in env
    assert "PROMETHEUS_MULTIPROC_DIR" not in env
    assert "UNRELATED_RUNTIME_VAR" not in env


class StubProcess:
    def __init__(self, stdout: bytes, stderr: bytes, returncode: int) -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode

    async def communicate(self, input: bytes) -> tuple[bytes, bytes]:
        self.input = input
        return self.stdout, self.stderr


@pytest.mark.asyncio
async def test_render_invoice_pdf_raises_on_subprocess_failure(
    invoice: Invoice, monkeypatch: pytest.MonkeyPatch
) -> None:
    process = StubProcess(b"", b"boom", 1)
    monkeypatch.setenv("POLAR_ENV", "testing")
    monkeypatch.setenv("POLAR_CUSTOM_OVERRIDE", "1")
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "/tmp/does-not-exist")

    async def create_subprocess_exec(*args: object, **kwargs: object) -> StubProcess:
        kwargs_dict = kwargs if isinstance(kwargs, Mapping) else {}
        assert args == (sys.executable, "-m", "polar.invoice.render")
        assert kwargs_dict["cwd"] == SERVER_DIRECTORY
        env = kwargs_dict["env"]
        assert isinstance(env, Mapping)
        assert env["POLAR_ENV"] == "testing"
        assert env["POLAR_CUSTOM_OVERRIDE"] == "1"
        assert "PROMETHEUS_MULTIPROC_DIR" not in env
        return process

    monkeypatch.setattr(
        "polar.invoice.render.asyncio.create_subprocess_exec", create_subprocess_exec
    )

    with pytest.raises(InvoiceRenderError, match="Invoice renderer failed: boom"):
        await render_invoice_pdf(invoice)
