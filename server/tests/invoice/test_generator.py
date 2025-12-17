import datetime
from pathlib import Path
from typing import Any

import pytest

from polar.invoice.generator import Invoice, InvoiceGenerator, InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.kit.tax import TaxabilityReason


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
        seller_additional_info="[support@polar.sh](mailto:support@polar.sh)",
        customer_name="John Doe",
        customer_address=Address(
            line1="456 Customer Ave",
            city="Los Angeles",
            state="CA",
            postal_code="90001",
            country=CountryAlpha2("US"),
        ),
        customer_additional_info="FR61954506077",
        subtotal_amount=100_00,
        discount_amount=10_00,
        taxability_reason=TaxabilityReason.standard_rated,
        tax_amount=18_00,
        tax_rate={
            "rate_type": "percentage",
            "display_name": "VAT",
            "basis_points": 2000,
            "country": "FR",
            "amount": None,
            "amount_currency": None,
            "state": None,
        },
        currency="usd",
        items=[
            InvoiceItem(
                description="SaaS Subscription",
                quantity=1,
                unit_amount=50_00,
                amount=50_00,
            ),
            InvoiceItem(
                description="Metered Usage",
                quantity=50,
                unit_amount=1_00,
                amount=50_00,
            ),
        ],
        notes=(
            """
Thank you for your business!

- [Legal terms](https://polar.sh) and conditions apply.
- Lawyers blah blah blah.
- This is a test invoice.
        """
        ),
    )


@pytest.mark.parametrize(
    ("overrides", "id"),
    [
        ({}, "basic"),
        (
            {
                "customer_name": "Super Long Company Name That Doesn't Fit On A Single Line"
            },
            "long_customer_name",
        ),
        (
            {
                "customer_address": Address(country=CountryAlpha2("FR")),
                "seller_additional_info": "[support@polar.sh](mailto:support@polar.sh)\nExtra line 1\nExtra line 2\nExtra line 3",
            },
            "long_seller_info",
        ),
    ],
)
def test_generator(overrides: dict[str, Any], id: str, invoice: Invoice) -> None:
    path = Path(__file__).parent / f"test_invoice_{id}.pdf"
    path.unlink(missing_ok=True)

    generator = InvoiceGenerator(invoice.model_copy(update=overrides))
    generator.generate()
    generator.output(str(path))

    assert path.exists()
