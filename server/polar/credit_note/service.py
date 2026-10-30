import asyncio
import hashlib
from datetime import datetime

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.integrations.aws.s3 import S3Service
from polar.kit.db.postgres import AsyncSession
from polar.models import CreditNote, CreditNoteItem, Refund
from polar.models.credit_note import CreditNoteReason
from polar.models.refund import RefundReason, RefundStatus
from polar.order.repository import OrderRepository

from .generator import CreditNote as CreditNoteDocument
from .render import render_credit_note_pdf
from .repository import CreditNoteRepository

CREDIT_NOTE_NUMBER_PREFIX = "CN"


class CreditNoteError(PolarError): ...


class CreditNoteAlreadyExists(CreditNoteError):
    def __init__(self) -> None:
        super().__init__("A credit note already exists for this refund.", 409)


class CreditNoteRefundNotEligible(CreditNoteError):
    def __init__(self) -> None:
        super().__init__(
            "Credit notes require a succeeded refund linked to an order.", 409
        )


class CreditNoteBillingDetailsMissing(CreditNoteError):
    def __init__(self) -> None:
        super().__init__(
            "An invoice number and billing details are required for a credit note.", 400
        )


class CreditNoteTaxIDMissing(CreditNoteError):
    def __init__(self) -> None:
        super().__init__(
            "A customer VAT ID is required for a reverse charge correction.", 400
        )


class CreditNotePDFNotGenerated(CreditNoteError):
    def __init__(self) -> None:
        super().__init__("Credit note PDF has not been generated.", 404)


class CreditNoteService:
    async def create_from_refund(
        self, session: AsyncSession, refund: Refund
    ) -> CreditNote:
        repository = CreditNoteRepository.from_session(session)
        if refund.credit_note_id is not None:
            raise CreditNoteAlreadyExists()
        if refund.status != RefundStatus.succeeded or refund.order_id is None:
            raise CreditNoteRefundNotEligible()

        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            refund.order_id,
            options=order_repository.get_eager_options(),
        )
        if (
            order is None
            or order.invoice_number is None
            or order.billing_name is None
            or order.billing_address is None
        ):
            raise CreditNoteBillingDetailsMissing()
        tax_id = order.tax_id
        if refund.reason == RefundReason.vat_reverse_charge_correction:
            tax_id = order.customer.tax_id
            if tax_id is None:
                raise CreditNoteTaxIDMissing()

        sequence = await CustomerRepository.from_session(
            session
        ).increment_credit_note_next_number(order.customer_id)
        credit_note = await repository.create(
            CreditNote(
                number=f"{CREDIT_NOTE_NUMBER_PREFIX}-{order.customer.short_id_str}-{sequence:04d}",
                order=order,
                reason=CreditNoteReason(refund.reason),
                currency=refund.currency,
                amount=refund.amount,
                tax_amount=refund.tax_amount,
                billing_name=order.billing_name,
                billing_address=order.billing_address.model_copy(deep=True),
                tax_id=tax_id,
                items=[
                    CreditNoteItem(
                        description=f"{refund.reason.replace('_', ' ').title()} for invoice {order.invoice_number}",
                        amount=refund.amount,
                        tax_amount=refund.tax_amount,
                    )
                ],
                refunds=[refund],
            ),
            flush=True,
        )
        return credit_note

    async def generate_pdf(
        self, session: AsyncSession, credit_note: CreditNote
    ) -> CreditNote:
        if credit_note.path is not None:
            return credit_note
        pdf = await render_credit_note_pdf(
            CreditNoteDocument.from_credit_note(credit_note)
        )
        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        path = f"credit-notes/{credit_note.order.organization_id}/{credit_note.id}.pdf"
        await asyncio.to_thread(s3.upload, pdf, path, "application/pdf")
        repository = CreditNoteRepository.from_session(session)
        return await repository.update(
            credit_note,
            update_dict={
                "path": path,
                "checksum": hashlib.sha256(pdf).hexdigest(),
            },
        )

    async def get_pdf_url(self, credit_note: CreditNote) -> tuple[str, datetime]:
        if credit_note.path is None:
            raise CreditNotePDFNotGenerated()
        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        return s3.generate_presigned_download_url(
            path=credit_note.path,
            filename=credit_note.pdf_filename,
            mime_type="application/pdf",
        )


credit_note = CreditNoteService()
