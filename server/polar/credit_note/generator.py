from typing import TYPE_CHECKING, ClassVar, Self

from polar.config import settings
from polar.invoice.generator import (
    Invoice,
    InvoiceGenerator,
    InvoiceHeadingItem,
    InvoiceItem,
    InvoiceTotalsItem,
    escape_markdown,
    format_date,
)
from polar.invoice.seller import get_polar_additional_info
from polar.kit.currency import format_currency
from polar.kit.utils import utc_now
from polar.models.credit_note import CreditNoteReason
from polar.models.refund import RefundStatus

if TYPE_CHECKING:
    from polar.models import CreditNote as CreditNoteModel


class CreditNote(Invoice):
    total_label: ClassVar[str] = "Total credit"

    invoice_number: str

    @property
    def heading_items(self) -> list[InvoiceHeadingItem]:
        return [
            InvoiceHeadingItem(label="Credit note number", value=self.number),
            InvoiceHeadingItem(label="Invoice number", value=self.invoice_number),
            InvoiceHeadingItem(label="Date of issue", value=self.date),
            *(self.extra_heading_items or []),
        ]

    @property
    def tax_items(self) -> list[InvoiceTotalsItem]:
        if self.tax_amount == 0:
            return []
        return [
            InvoiceTotalsItem(
                label="Tax", amount=self.tax_amount, currency=self.currency
            )
        ]

    @classmethod
    def from_credit_note(cls, credit_note: "CreditNoteModel") -> Self:
        assert credit_note.billing_name is not None
        assert credit_note.billing_address is not None
        assert credit_note.order.invoice_number is not None

        notes = None
        if (
            credit_note.reason == CreditNoteReason.vat_reverse_charge_correction
            and credit_note.tax_id is not None
        ):
            notes = (
                f"VAT of {format_currency(credit_note.tax_amount, credit_note.currency)} "
                "originally charged on invoice "
                f"{escape_markdown(credit_note.order.invoice_number)} is credited.\n"
            )
            if credit_note.amount == 0:
                notes += (
                    "The original net consideration of "
                    f"{format_currency(credit_note.order.net_amount, credit_note.order.currency)} "
                    "remains unchanged.\n"
                )
            notes += (
                "Corrected VAT treatment: reverse charge. "
                "VAT to be accounted for by the recipient.\n"
                f"Customer VAT ID: {escape_markdown(credit_note.tax_id[0])}"
            )
        elif credit_note.reason == CreditNoteReason.tax_refund:
            notes = (
                f"Tax of {format_currency(credit_note.tax_amount, credit_note.currency)} "
                "originally charged on invoice "
                f"{escape_markdown(credit_note.order.invoice_number)} is credited "
                "as a correction to the tax charged on that invoice."
            )
            if credit_note.amount == 0:
                notes += (
                    "\nThe original price excluding tax of "
                    f"{format_currency(credit_note.order.net_amount, credit_note.order.currency)} "
                    "remains unchanged."
                )

        return cls(
            number=credit_note.number,
            invoice_number=credit_note.order.invoice_number,
            date=credit_note.created_at,
            seller_name=settings.INVOICES_NAME,
            seller_address=settings.INVOICES_ADDRESS,
            seller_additional_info=get_polar_additional_info(
                credit_note.billing_address
            ),
            organization_name=credit_note.order.organization.name,
            customer_name=credit_note.billing_name,
            customer_address=credit_note.billing_address,
            customer_additional_info=escape_markdown(credit_note.tax_id[0])
            if credit_note.tax_id
            else None,
            customer_locale=credit_note.order.customer.locale,
            subtotal_amount=credit_note.amount,
            discount_amount=0,
            net_amount=credit_note.amount,
            tax_amount=credit_note.tax_amount,
            currency=credit_note.currency,
            notes=notes,
            items=[
                InvoiceItem(
                    description=item.description,
                    quantity=1,
                    unit_amount=item.amount,
                    amount=item.amount,
                )
                for item in credit_note.items
            ],
            extra_totals_items=[
                InvoiceTotalsItem(
                    label=f"Refund ({format_date(refund.created_at)})"
                    + (
                        f" ({refund.status})"
                        if refund.status in {RefundStatus.failed, RefundStatus.canceled}
                        else ""
                    ),
                    amount=refund.total_amount,
                    currency=refund.currency,
                )
                for refund in credit_note.refunds
            ],
        )


class CreditNoteGenerator(InvoiceGenerator):
    def set_metadata(self) -> None:
        self.set_title(f"Credit Note {self.data.number}")
        self.set_creator("Polar")
        self.set_author(settings.INVOICES_NAME)
        self.set_creation_date(utc_now())
