import datetime
from pathlib import Path
from typing import Any

import pytest

from polar.invoice.generator import Invoice, InvoiceGenerator, InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.kit.tax import TaxabilityReason
from polar.models import Order


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
    "overrides,id",
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


def test_invoice_from_order_with_seats() -> None:
    """Test that Invoice.from_order() correctly handles seat-based orders."""
    # Create a mock order with seats
    order = Order(
        id="order_123",
        seats=5,
        billing_name="Test Customer",
        billing_address=Address(
            line1="123 Test St",
            city="Test City",
            state="CA",
            postal_code="12345",
            country=CountryAlpha2("US"),
        ),
        invoice_number="INV-001",
        created_at=datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.UTC),
        subtotal_amount=50_00,
        applied_balance_amount=None,
        discount_amount=0,
        taxability_reason=None,
        tax_amount=0,
        tax_rate=None,
        currency="usd",
        items=[],
    )

    # Add an order item with total amount for 5 seats
    from polar.models import OrderItem

    order_item = OrderItem(
        label="Seat-based License",
        amount=50_00,  # $50 total for 5 seats
        tax_amount=0,
        proration=False,
        quantity=5,  # Store the quantity in the order item
    )
    order.items = [order_item]

    # Generate invoice from order
    invoice = Invoice.from_order(order)

    # Verify the invoice items have correct seat quantities
    assert len(invoice.items) == 1
    item = invoice.items[0]

    # Should have quantity = 5 (number of seats)
    assert item.quantity == 5

    # Should have unit_amount = $10 (total $50 / 5 seats)
    assert item.unit_amount == 10_00

    # Total amount should remain unchanged
    assert item.amount == 50_00


def test_invoice_from_order_without_seats() -> None:
    """Test that Invoice.from_order() keeps quantity=1 for non-seat orders."""
    # Create a mock order without seats
    order = Order(
        id="order_456",
        seats=None,
        billing_name="Test Customer",
        billing_address=Address(
            line1="123 Test St",
            city="Test City",
            state="CA",
            postal_code="12345",
            country=CountryAlpha2("US"),
        ),
        invoice_number="INV-002",
        created_at=datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.UTC),
        subtotal_amount=30_00,
        applied_balance_amount=None,
        discount_amount=0,
        taxability_reason=None,
        tax_amount=0,
        tax_rate=None,
        currency="usd",
        items=[],
    )

    # Add a regular order item
    from polar.models import OrderItem

    order_item = OrderItem(
        label="Regular Product",
        amount=30_00,
        tax_amount=0,
        proration=False,
        quantity=1,  # Default quantity
    )
    order.items = [order_item]

    # Generate invoice from order
    invoice = Invoice.from_order(order)

    # Verify the invoice items have quantity=1
    assert len(invoice.items) == 1
    item = invoice.items[0]

    # Should have quantity = 1 (default for non-seat orders)
    assert item.quantity == 1

    # Should have unit_amount = total amount
    assert item.unit_amount == 30_00

    # Total amount should be unchanged
    assert item.amount == 30_00
