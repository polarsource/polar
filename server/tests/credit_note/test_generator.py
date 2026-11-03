import pytest

from polar.credit_note.generator import CreditNote as CreditNoteDocument
from polar.models import CreditNote, Refund
from polar.models.credit_note import CreditNoteReason
from polar.models.refund import RefundStatus


class TestFromCreditNote:
    @pytest.mark.parametrize(
        ("reason", "has_tax_id", "amount", "has_notice"),
        [
            (CreditNoteReason.vat_reverse_charge_correction, True, 0, True),
            (CreditNoteReason.vat_reverse_charge_correction, True, 1000, True),
            (CreditNoteReason.vat_reverse_charge_correction, False, 0, False),
            (CreditNoteReason.customer_request, True, 0, False),
        ],
    )
    def test_reverse_charge_notice(
        self,
        credit_note: CreditNote,
        reason: CreditNoteReason,
        has_tax_id: bool,
        amount: int,
        has_notice: bool,
    ) -> None:
        credit_note.reason = reason
        credit_note.amount = amount
        if not has_tax_id:
            credit_note.tax_id = None

        document = CreditNoteDocument.from_credit_note(credit_note)

        if has_notice:
            assert document.notes is not None
            assert (
                "VAT of $20.00 originally charged on invoice INV-0001 is credited."
                in document.notes
            )
            assert (
                "Corrected VAT treatment: reverse charge. VAT to be accounted for by the recipient."
                in document.notes
            )
            assert "Customer VAT ID: FR12345678901" in document.notes
            if amount == 0:
                assert (
                    "The original net consideration of $100.00 remains unchanged."
                    in document.notes
                )
            else:
                assert "unchanged" not in document.notes
        else:
            assert document.notes is None

    @pytest.mark.parametrize("amount", [0, 1000])
    @pytest.mark.parametrize("has_tax_id", [False, True])
    def test_tax_refund_note(
        self, credit_note: CreditNote, amount: int, has_tax_id: bool
    ) -> None:
        credit_note.reason = CreditNoteReason.tax_refund
        credit_note.amount = amount
        if not has_tax_id:
            credit_note.tax_id = None

        document = CreditNoteDocument.from_credit_note(credit_note)

        assert document.notes is not None
        assert (
            "Tax of $20.00 originally charged on invoice INV-0001 is credited "
            "as a correction to the tax charged on that invoice."
        ) in document.notes
        assert "reverse charge" not in document.notes
        assert "exemption" not in document.notes
        if amount == 0:
            assert (
                "The original price excluding tax of $100.00 remains unchanged."
                in document.notes
            )
        else:
            assert "unchanged" not in document.notes

    def test_billing_snapshot_and_items(self, credit_note: CreditNote) -> None:
        document = CreditNoteDocument.from_credit_note(credit_note)

        assert document.customer_name == "Original Customer"
        assert document.customer_address == credit_note.billing_address
        assert document.customer_additional_info == "FR12345678901"
        assert document.date == credit_note.created_at
        assert document.items[0].description == "Subscription credit"
        assert document.items[0].amount == 10000
        assert document.statement_descriptor is None
        assert [(item.label, item.value) for item in document.heading_items] == [
            ("Credit note number", "CN-0001"),
            ("Invoice number", "INV-0001"),
            ("Date of issue", credit_note.created_at),
        ]

    def test_totals_without_refunds(self, credit_note: CreditNote) -> None:
        document = CreditNoteDocument.from_credit_note(credit_note)

        totals = document.totals_items
        assert [(item.label, item.amount) for item in totals] == [
            ("Subtotal", 10000),
            ("Total excluding tax", 10000),
            ("Tax", 2000),
            ("Total credit", 12000),
        ]
        assert totals[-1].emphasized

    @pytest.mark.parametrize(
        ("amount", "tax_amount"), [(5000, 1000), (0, 2000), (5000, 0)]
    )
    def test_credit_amounts(
        self, credit_note: CreditNote, amount: int, tax_amount: int
    ) -> None:
        credit_note.amount = amount
        credit_note.tax_amount = tax_amount
        credit_note.items[0].amount = amount
        credit_note.items[0].tax_amount = tax_amount

        document = CreditNoteDocument.from_credit_note(credit_note)

        assert document.items[0].amount == amount
        assert document.net_amount == amount
        assert document.tax_amount == tax_amount
        assert document.totals_items[-1].amount == amount + tax_amount

    def test_linked_refunds_follow_total(self, credit_note: CreditNote) -> None:
        credit_note.refunds = [
            Refund(
                status=RefundStatus.succeeded,
                created_at=credit_note.created_at,
                amount=4000,
                tax_amount=800,
                currency="usd",
            ),
            Refund(
                status=RefundStatus.pending,
                created_at=credit_note.created_at,
                amount=6000,
                tax_amount=1200,
                currency="usd",
            ),
        ]

        document = CreditNoteDocument.from_credit_note(credit_note)

        assert [(item.label, item.amount) for item in document.totals_items[-3:]] == [
            ("Total credit", 12000),
            ("Refund (October 21, 2026)", 4800),
            ("Refund (October 21, 2026)", 7200),
        ]

    @pytest.mark.parametrize(
        ("status", "label"),
        [
            (RefundStatus.succeeded, "Refund (October 21, 2026)"),
            (RefundStatus.pending, "Refund (October 21, 2026)"),
            (RefundStatus.failed, "Refund (October 21, 2026) (failed)"),
            (RefundStatus.canceled, "Refund (October 21, 2026) (canceled)"),
        ],
    )
    def test_refund_date_and_status(
        self, credit_note: CreditNote, status: RefundStatus, label: str
    ) -> None:
        credit_note.refunds = [
            Refund(
                created_at=credit_note.created_at,
                status=status,
                amount=10000,
                tax_amount=2000,
                currency="usd",
            )
        ]

        document = CreditNoteDocument.from_credit_note(credit_note)

        assert document.totals_items[-1].label == label
