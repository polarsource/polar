from io import BytesIO

import pytest
from pypdf import PdfReader

from polar.credit_note.generator import CreditNote as CreditNoteDocument
from polar.credit_note.render import (
    CreditNoteRenderError,
    CreditNoteRenderRequest,
    render_credit_note_pdf,
)
from polar.models import CreditNote, Refund
from polar.models.credit_note import CreditNoteReason
from polar.models.refund import RefundStatus


@pytest.mark.anyio
class TestRenderCreditNotePDF:
    async def test_generic_tax_refund_note(self, credit_note: CreditNote) -> None:
        credit_note.reason = CreditNoteReason.tax_refund
        credit_note.tax_id = None
        credit_note.amount = 0
        credit_note.items[0].amount = 0

        pdf = await render_credit_note_pdf(
            CreditNoteDocument.from_credit_note(credit_note)
        )

        text = " ".join(PdfReader(BytesIO(pdf)).pages[0].extract_text().split())
        assert (
            "Tax of $20.00 originally charged on invoice INV-0001 is credited "
            "as a correction to the tax charged on that invoice."
        ) in text
        assert "The original price excluding tax of $100.00 remains unchanged." in text
        assert "reverse charge" not in text
        assert "exemption" not in text

    async def test_reverse_charge_tax_only_credit(
        self, credit_note: CreditNote
    ) -> None:
        credit_note.reason = CreditNoteReason.vat_reverse_charge_correction
        credit_note.amount = 0
        credit_note.items[0].amount = 0
        credit_note.items[0].description = "VAT correction for invoice INV-0001"

        pdf = await render_credit_note_pdf(
            CreditNoteDocument.from_credit_note(credit_note)
        )

        text = PdfReader(BytesIO(pdf)).pages[0].extract_text()
        assert "VAT correction for invoice INV-0001" in text
        assert "Total credit $20.00" in text
        assert (
            "VAT of $20.00 originally charged on invoice INV-0001 is credited." in text
        )
        assert "The original net consideration of $100.00 remains unchanged." in text
        assert "Corrected VAT treatment: reverse charge." in text
        assert "VAT to be accounted for by the recipient." in text
        assert "Customer VAT ID: FR12345678901" in text

    @pytest.mark.parametrize("refund_status", [None, *RefundStatus])
    async def test_document_content(
        self, credit_note: CreditNote, refund_status: RefundStatus | None
    ) -> None:
        if refund_status is not None:
            credit_note.refunds = [
                Refund(
                    status=refund_status,
                    created_at=credit_note.created_at,
                    amount=10000,
                    tax_amount=2000,
                    currency="usd",
                )
            ]

        pdf = await render_credit_note_pdf(
            CreditNoteDocument.from_credit_note(credit_note)
        )

        reader = PdfReader(BytesIO(pdf))
        text = reader.pages[0].extract_text()
        assert text.splitlines()[0] == "Credit Note"
        assert "Credit note number CN-0001" in text
        assert "Invoice number INV-0001" in text
        assert "Original Customer" in text
        assert "Subscription credit" in text
        assert "Total credit $120.00" in text
        assert reader.metadata is not None
        assert reader.metadata.title == "Credit Note CN-0001"
        if refund_status is not None:
            assert "Refund (October 21, 2026)" in text
            assert text.count("$120.00") == 2
            assert "succeeded" not in text
            assert "pending" not in text
            if refund_status in {RefundStatus.failed, RefundStatus.canceled}:
                assert f"({refund_status})" in text
            assert text.index("Refund") > text.index("Total credit")
        else:
            assert "Refund" not in text

    async def test_renderer_error(
        self, credit_note: CreditNote, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            CreditNoteRenderRequest, "model_dump_json", lambda self: "{}"
        )

        with pytest.raises(CreditNoteRenderError, match="Credit note renderer failed:"):
            await render_credit_note_pdf(
                CreditNoteDocument.from_credit_note(credit_note)
            )
