from datetime import UTC, datetime

import pytest

from polar.kit.address import Address, CountryAlpha2
from polar.models import CreditNote, CreditNoteItem, Customer, Order, Organization
from polar.models.credit_note import CreditNoteReason
from polar.tax.tax_id import TaxIDFormat


@pytest.fixture
def credit_note() -> CreditNote:
    return CreditNote(
        number="CN-0001",
        created_at=datetime(2026, 10, 21, tzinfo=UTC),
        currency="usd",
        reason=CreditNoteReason.customer_request,
        amount=10000,
        tax_amount=2000,
        billing_name="Original Customer",
        billing_address=Address(
            line1="12 Customer Street",
            city="Paris",
            postal_code="75001",
            country=CountryAlpha2("FR"),
        ),
        tax_id=("FR12345678901", TaxIDFormat.eu_vat),
        order=Order(
            invoice_number="INV-0001",
            net_amount=10000,
            currency="usd",
            billing_name="Updated Customer",
            organization=Organization(name="Example Store"),
            customer=Customer(locale="fr"),
        ),
        items=[
            CreditNoteItem(
                description="Subscription credit", amount=10000, tax_amount=2000
            )
        ],
        refunds=[],
    )
