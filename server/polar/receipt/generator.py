from datetime import datetime
from typing import TYPE_CHECKING, Any, Self

from fpdf.enums import Align, TableBordersLayout, XPos, YPos
from fpdf.fonts import FontFace
from pydantic import BaseModel, Field

from polar.config import settings
from polar.invoice.generator import (
    Invoice,
    InvoiceGenerator,
    InvoiceHeadingItem,
    InvoiceItem,
    InvoiceTotalsItem,
    format_date,
)
from polar.kit.currency import format_currency
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from polar.models import Order, Payment, Refund


class ReceiptRefund(BaseModel):
    date: datetime
    amount: int
    tax_amount: int


class ReceiptPayment(BaseModel):
    date: datetime
    method: str
    method_metadata: dict[str, Any] = Field(default_factory=dict)
    amount: int
    currency: str
    processor_id: str | None = None

    @property
    def display_method(self) -> str:
        """Format the payment method as 'Visa — 4242' style."""
        brand = self.method_metadata.get("brand")
        last4 = self.method_metadata.get("last4")
        if self.method == "card" and brand and last4:
            return f"{brand.title()} — {last4}"
        if last4:
            return f"{self.method.title()} — {last4}"
        return self.method.replace("_", " ").title()


class Receipt(Invoice):
    invoice_number: str | None = None
    paid_at: datetime | None = None
    payments: list[ReceiptPayment] = []
    refunds: list[ReceiptRefund] = []
    rendered_at: datetime = Field(default_factory=utc_now)

    @property
    def heading_items(self) -> list[InvoiceHeadingItem]:
        items: list[InvoiceHeadingItem] = []
        if self.invoice_number is not None:
            items.append(
                InvoiceHeadingItem(label="Invoice number", value=self.invoice_number)
            )
        items.append(InvoiceHeadingItem(label="Receipt number", value=self.number))
        if self.paid_at is not None:
            items.append(InvoiceHeadingItem(label="Date paid", value=self.paid_at))
        else:
            items.append(InvoiceHeadingItem(label="Date of issue", value=self.date))
        items.extend(self.extra_heading_items or [])
        return items

    @property
    def total_refunded(self) -> int:
        return sum(r.amount + r.tax_amount for r in self.refunds)

    @property
    def totals_items(self) -> list[InvoiceTotalsItem]:
        items = list(super().totals_items)
        if self.payments:
            items.append(
                InvoiceTotalsItem(
                    label="Amount paid",
                    amount=sum(p.amount for p in self.payments),
                    currency=self.currency,
                )
            )
        if self.refunds:
            items.append(
                InvoiceTotalsItem(
                    label="Amount refunded",
                    amount=-self.total_refunded,
                    currency=self.currency,
                )
            )
        return items

    @classmethod
    def from_order(  # type: ignore[override]
        cls,
        order: "Order",
        payments: list["Payment"],
        refunds: list["Refund"],
    ) -> Self:
        assert order.receipt_number is not None
        assert order.billing_name is not None
        assert order.billing_address is not None

        sorted_payments = sorted(payments, key=lambda p: p.created_at)
        paid_at = sorted_payments[0].created_at if sorted_payments else None

        additional_info_parts: list[str] = []
        if order.tax_id:
            additional_info_parts.append(order.tax_id[0])
        if order.customer.email:
            additional_info_parts.append(order.customer.email)
        customer_additional_info = (
            "\n".join(additional_info_parts) if additional_info_parts else None
        )

        return cls(
            number=order.receipt_number,
            invoice_number=order.invoice_number,
            date=order.created_at,
            paid_at=paid_at,
            seller_name=settings.INVOICES_NAME,
            seller_address=settings.INVOICES_ADDRESS,
            seller_additional_info=settings.INVOICES_ADDITIONAL_INFO,
            customer_name=order.billing_name,
            customer_additional_info=customer_additional_info,
            customer_address=order.billing_address,
            customer_locale=order.customer.locale,
            subtotal_amount=order.subtotal_amount,
            applied_balance_amount=order.applied_balance_amount,
            discount_amount=order.discount_amount,
            tax_amount=order.tax_amount,
            tax_breakdown=order.tax_breakdown or [],
            net_amount=order.net_amount,
            currency=order.currency,
            items=[
                InvoiceItem(
                    description=item.label,
                    quantity=1,
                    unit_amount=item.amount,
                    amount=item.amount,
                )
                for item in order.items
            ],
            payments=[
                ReceiptPayment(
                    date=payment.created_at,
                    method=payment.method,
                    method_metadata=payment.method_metadata,
                    amount=payment.amount,
                    currency=payment.currency,
                    processor_id=payment.processor_id,
                )
                for payment in sorted_payments
            ],
            refunds=[
                ReceiptRefund(
                    date=refund.created_at,
                    amount=refund.amount,
                    tax_amount=refund.tax_amount,
                )
                for refund in refunds
            ],
        )


class ReceiptGenerator(InvoiceGenerator):
    """Generate a receipt PDF, mirroring the invoice layout with payment history
    and an optional Refunds section."""

    data: Receipt

    def footer(self) -> None:
        self.set_y(-self.b_margin)
        self.set_font(size=self.footer_font_size)
        self.cell(self.epw / 3, 10, f"{self.data.number}", align=Align.L)
        self.cell(
            self.epw / 3,
            10,
            f"Generated {format_date(self.data.rendered_at)}",
            align=Align.C,
        )
        self.cell(self.epw / 3, 10, f"Page {self.page_no()} of {{nb}}", align=Align.R)

    def generate(self) -> None:
        super().generate()
        if self.data.payments or self._has_applied_balance:
            self._render_payment_history_section()
        if self.data.refunds:
            self._render_refunds_section()

    @property
    def _has_applied_balance(self) -> bool:
        return (self.data.applied_balance_amount or 0) < 0

    def _render_section_title(self, title: str) -> None:
        self.set_y(self.get_y() + self.elements_y_margin)
        self.set_font(style="B", size=self.base_font_size)
        self.cell(
            text=title,
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
            h=self.cell_height(),
        )
        self.set_font(style="", size=self.base_font_size)
        self.set_draw_color(*self.table_borders_color)

    def _render_payment_history_section(self) -> None:
        self._render_section_title("Payment history")
        with self.table(
            col_widths=(60, 40, 40),
            text_align=(Align.L, Align.L, Align.R),
            headings_style=FontFace(size_pt=self.table_header_font_size),
            line_height=self.items_table_row_height,
            borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        ) as table:
            header = table.row()
            header.cell("Payment method")
            header.cell("Date")
            header.cell("Amount paid")

            if self._has_applied_balance:
                row = table.row()
                row.cell(self._shape_text("Existing customer balance"))
                row.cell(format_date(self.data.date))
                row.cell(
                    format_currency(
                        -(self.data.applied_balance_amount or 0), self.data.currency
                    )
                )

            for payment in self.data.payments:
                row = table.row()
                row.cell(self._shape_text(payment.display_method))
                row.cell(format_date(payment.date))
                row.cell(format_currency(payment.amount, payment.currency))

    def _render_refunds_section(self) -> None:
        self._render_section_title("Refunds")
        with self.table(
            col_widths=(150, 30),
            text_align=(Align.L, Align.R),
            headings_style=FontFace(size_pt=self.table_header_font_size),
            line_height=self.items_table_row_height,
            borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        ) as table:
            header = table.row()
            header.cell("Date")
            header.cell("Amount")

            for refund in self.data.refunds:
                row = table.row()
                row.cell(format_date(refund.date))
                row.cell(
                    format_currency(
                        -(refund.amount + refund.tax_amount), self.data.currency
                    )
                )

        self.set_y(self.get_y() + self.elements_y_margin / 2)
        self.set_font(style="B", size=self.base_font_size)
        self.cell(
            self.epw - 30,
            self.cell_height(),
            text="Total refunded",
            align=Align.R,
        )
        self.cell(
            30,
            self.cell_height(),
            text=format_currency(-self.data.total_refunded, self.data.currency),
            align=Align.R,
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_font(style="", size=self.base_font_size)

    def set_metadata(self) -> None:
        self.set_title(f"Receipt {self.data.number}")
        self.set_creator("Polar")
        self.set_author(settings.INVOICES_NAME)
        self.set_creation_date(utc_now())


__all__ = ["Receipt", "ReceiptGenerator", "ReceiptPayment", "ReceiptRefund"]
