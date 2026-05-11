from polar.invoice.generator import InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.receipt.generator import (
    Receipt,
    ReceiptGenerator,
    ReceiptPayment,
    ReceiptRefund,
)


def _default_payment() -> ReceiptPayment:
    return ReceiptPayment(
        date=utc_now(),
        method="card",
        method_metadata={"brand": "visa", "last4": "4242"},
        amount=10000,
        currency="usd",
        processor_id="pi_test",
    )


def _build_receipt(
    *,
    payments: list[ReceiptPayment] | None = None,
    refunds: list[ReceiptRefund] | None = None,
    applied_balance_amount: int | None = None,
) -> Receipt:
    addr = Address(
        line1="123 Test St",
        postal_code="94104",
        city="San Francisco",
        state="US-CA",
        country=CountryAlpha2("US"),
    )
    now = utc_now()
    if payments is None:
        payments = [_default_payment()]
    return Receipt(
        number="RCPT-AB1-0001",
        invoice_number="INV-AB1-0001",
        date=now,
        paid_at=now,
        seller_name="Polar",
        seller_address=addr,
        customer_name="Test Customer",
        customer_address=addr,
        customer_additional_info="buyer@example.com",
        subtotal_amount=10000,
        applied_balance_amount=applied_balance_amount,
        discount_amount=0,
        tax_breakdown=[],
        tax_amount=0,
        net_amount=10000,
        currency="usd",
        items=[
            InvoiceItem(
                description="Test Product",
                quantity=1,
                unit_amount=10000,
                amount=10000,
            )
        ],
        payments=payments,
        refunds=refunds or [],
        rendered_at=now,
    )


class TestReceiptGenerator:
    def test_renders_pdf_bytes(self) -> None:
        receipt = _build_receipt()
        generator = ReceiptGenerator(
            receipt, heading_title="Receipt", add_sandbox_warning=False
        )
        generator.generate()
        output = generator.output()

        assert isinstance(output, bytearray)
        assert len(output) > 100
        assert bytes(output).startswith(b"%PDF-")

    def test_renders_with_refunds(self) -> None:
        now = utc_now()
        receipt = _build_receipt(
            refunds=[
                ReceiptRefund(date=now, amount=5000, tax_amount=0),
                ReceiptRefund(date=now, amount=5000, tax_amount=0),
            ],
        )
        generator = ReceiptGenerator(
            receipt, heading_title="Receipt", add_sandbox_warning=False
        )
        generator.generate()
        output = generator.output()

        assert bytes(output).startswith(b"%PDF-")

    def test_heading_items_include_invoice_and_paid_date(self) -> None:
        receipt = _build_receipt()
        labels = [item.label for item in receipt.heading_items]
        assert labels == ["Invoice number", "Receipt number", "Date paid"]

    def test_heading_items_fall_back_when_missing(self) -> None:
        receipt = _build_receipt()
        receipt = receipt.model_copy(update={"invoice_number": None, "paid_at": None})
        labels = [item.label for item in receipt.heading_items]
        assert labels == ["Receipt number", "Date of issue"]

    def test_amount_paid_in_totals(self) -> None:
        receipt = _build_receipt()
        totals_labels = [t.label for t in receipt.totals_items]
        assert "Amount paid" in totals_labels
        amount_paid = next(t for t in receipt.totals_items if t.label == "Amount paid")
        assert amount_paid.amount == 10000

    def test_no_amount_paid_when_no_payments(self) -> None:
        receipt = _build_receipt(payments=[])
        totals_labels = [t.label for t in receipt.totals_items]
        assert "Amount paid" not in totals_labels

    def test_amount_refunded_in_totals(self) -> None:
        now = utc_now()
        receipt = _build_receipt(
            refunds=[
                ReceiptRefund(date=now, amount=4000, tax_amount=0),
            ],
        )
        totals = {t.label: t.amount for t in receipt.totals_items}
        assert totals["Amount paid"] == 10000
        assert totals["Amount refunded"] == -4000

    def test_no_amount_refunded_when_no_refunds(self) -> None:
        receipt = _build_receipt()
        totals_labels = [t.label for t in receipt.totals_items]
        assert "Amount refunded" not in totals_labels

    def test_renders_payment_history_with_only_applied_balance(self) -> None:
        receipt = _build_receipt(payments=[], applied_balance_amount=-10000)
        generator = ReceiptGenerator(
            receipt, heading_title="Receipt", add_sandbox_warning=False
        )
        generator.generate()
        output = generator.output()

        assert bytes(output).startswith(b"%PDF-")

    def test_renders_without_customer_address(self) -> None:
        receipt = _build_receipt().model_copy(update={"customer_address": None})
        generator = ReceiptGenerator(
            receipt, heading_title="Receipt", add_sandbox_warning=False
        )
        generator.generate()
        output = generator.output()

        assert bytes(output).startswith(b"%PDF-")


class TestReceiptPayment:
    def test_card_with_brand_and_last4(self) -> None:
        payment = ReceiptPayment(
            date=utc_now(),
            method="card",
            method_metadata={"brand": "mastercard", "last4": "9030"},
            amount=10000,
            currency="usd",
        )
        assert payment.display_method == "Mastercard — 9030"

    def test_card_without_metadata(self) -> None:
        payment = ReceiptPayment(
            date=utc_now(),
            method="card",
            amount=10000,
            currency="usd",
        )
        assert payment.display_method == "Card"

    def test_non_card_method(self) -> None:
        payment = ReceiptPayment(
            date=utc_now(),
            method="bank_transfer",
            amount=10000,
            currency="usd",
        )
        assert payment.display_method == "Bank Transfer"
