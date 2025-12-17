from datetime import date, datetime
from pathlib import Path
from typing import ClassVar, Self

import pycountry
from babel.dates import format_date as _format_date
from babel.numbers import format_currency as _format_currency
from babel.numbers import format_decimal as _format_decimal
from babel.numbers import format_percent as _format_percent
from fpdf import FPDF
from fpdf.enums import Align, TableBordersLayout, XPos, YPos
from fpdf.fonts import FontFace
from pydantic import BaseModel

from polar.config import Environment, settings
from polar.kit.address import Address
from polar.kit.tax import TaxabilityReason, TaxRate
from polar.kit.utils import utc_now
from polar.models import Order


def format_currency(amount: int, currency: str) -> str:
    return _format_currency(amount / 100, currency.upper(), locale="en_US")


def format_number(n: int) -> str:
    return _format_decimal(n, locale="en_US")


def format_percent(basis_points: int) -> str:
    return _format_percent(basis_points / 10000, locale="en_US")


def format_date(date: date | datetime) -> str:
    return _format_date(date, format="long", locale="en_US")


class InvoiceItem(BaseModel):
    description: str
    quantity: int
    unit_amount: int
    amount: int


class InvoiceHeadingItem(BaseModel):
    label: str
    value: str | datetime

    @property
    def display_value(self) -> str:
        if isinstance(self.value, datetime):
            return format_date(self.value)
        return self.value


class InvoiceTotalsItem(BaseModel):
    label: str
    amount: int
    currency: str


class Invoice(BaseModel):
    number: str
    date: datetime
    seller_name: str
    seller_address: Address
    seller_additional_info: str | None = None
    customer_name: str
    customer_address: Address
    customer_additional_info: str | None = None
    subtotal_amount: int
    applied_balance_amount: int | None = None
    discount_amount: int
    taxability_reason: TaxabilityReason | None
    tax_amount: int
    tax_rate: TaxRate | None
    currency: str
    items: list[InvoiceItem]
    notes: str | None = None
    extra_heading_items: list[InvoiceHeadingItem] | None = None
    extra_totals_items: list[InvoiceTotalsItem] | None = None

    @property
    def heading_items(self) -> list[InvoiceHeadingItem]:
        return [
            InvoiceHeadingItem(label="Invoice number", value=self.number),
            InvoiceHeadingItem(label="Date of issue", value=self.date),
            *(self.extra_heading_items or []),
        ]

    @property
    def tax_displayed(self) -> bool:
        return self.taxability_reason is not None and self.taxability_reason in {
            TaxabilityReason.standard_rated,
            TaxabilityReason.reverse_charge,
        }

    @property
    def tax_label(self) -> str:
        if self.tax_rate is None:
            return "Tax"

        label = self.tax_rate["display_name"]

        if self.taxability_reason == TaxabilityReason.reverse_charge:
            return f"{label} (0% Reverse Charge)"

        if self.tax_rate["country"] is not None:
            country = pycountry.countries.get(alpha_2=self.tax_rate["country"])
            if country is not None:
                label += f" — {country.name}"

        if self.tax_rate["basis_points"] is not None:
            label += f" ({format_percent(self.tax_rate['basis_points'])})"

        return label

    @property
    def totals_items(self) -> list[InvoiceTotalsItem]:
        items: list[InvoiceTotalsItem] = [
            InvoiceTotalsItem(
                label="Subtotal",
                amount=self.subtotal_amount,
                currency=self.currency,
            )
        ]

        if self.discount_amount > 0:
            items.append(
                InvoiceTotalsItem(
                    label="Discount",
                    amount=-self.discount_amount,
                    currency=self.currency,
                )
            )

        if self.tax_displayed:
            items.append(
                InvoiceTotalsItem(
                    label=self.tax_label,
                    amount=self.tax_amount,
                    currency=self.currency,
                )
            )

        total = self.subtotal_amount - self.discount_amount + self.tax_amount
        items.append(
            InvoiceTotalsItem(
                label="Total",
                amount=total,
                currency=self.currency,
            )
        )

        if self.applied_balance_amount:
            items.append(
                InvoiceTotalsItem(
                    label="Applied balance",
                    amount=self.applied_balance_amount,
                    currency=self.currency,
                )
            )
            items.append(
                InvoiceTotalsItem(
                    label="To be paid",
                    amount=total + self.applied_balance_amount,
                    currency=self.currency,
                )
            )

        items.extend(self.extra_totals_items or [])
        return items

    @classmethod
    def from_order(cls, order: Order) -> Self:
        assert order.billing_name is not None
        assert order.billing_address is not None
        assert order.invoice_number is not None

        return cls(
            number=order.invoice_number,
            date=order.created_at,
            seller_name=settings.INVOICES_NAME,
            seller_address=settings.INVOICES_ADDRESS,
            seller_additional_info=settings.INVOICES_ADDITIONAL_INFO,
            customer_name=order.billing_name,
            customer_additional_info=order.tax_id[0] if order.tax_id else None,
            customer_address=order.billing_address,
            subtotal_amount=order.subtotal_amount,
            applied_balance_amount=order.applied_balance_amount,
            discount_amount=order.discount_amount,
            taxability_reason=order.taxability_reason,
            tax_amount=order.tax_amount,
            tax_rate=order.tax_rate,
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
        )


class InvoiceGenerator(FPDF):
    """Class to generate an invoice PDF using fpdf2."""

    logo: ClassVar[Path] = Path(__file__).parent / "invoice-logo.svg"
    """Path to the logo image for the invoice."""

    regular_font_file = Path(__file__).parent / "fonts/Geist-Regular.otf"
    """Path to the regular font file."""

    bold_font_file = Path(__file__).parent / "fonts/Geist-Bold.otf"
    """Path to the bold font file."""

    font_name: ClassVar[str] = "geist"
    """Font family name."""

    base_font_size: ClassVar[int] = 10
    """Base font size in points."""

    footer_font_size: ClassVar[int] = 8
    """Font size for the footer in points."""

    table_header_font_size: ClassVar[int] = 8
    """Font size for table headers in points."""

    table_borders_color: ClassVar[tuple[int, int, int]] = (220, 220, 220)
    """Color for table borders in RGB format."""

    line_height_percentage: ClassVar[float] = 1.5
    """Line height as a percentage of the font size."""

    elements_y_margin: ClassVar[int] = 10
    """Vertical margin between elements."""

    items_table_row_height: ClassVar[int] = 7
    """Height of each row in the items table in points."""

    totals_table_row_height: ClassVar[int] = 6
    """Height of each row in the totals table in points."""

    def __init__(
        self,
        data: Invoice,
        heading_title: str = "Invoice",
        add_sandbox_warning: bool = settings.ENV == Environment.sandbox,
    ) -> None:
        super().__init__()

        self.add_font(self.font_name, fname=self.regular_font_file)
        self.add_font(self.font_name, fname=self.bold_font_file, style="B")
        self.set_font(self.font_name, size=self.base_font_size)

        self.alias_nb_pages()
        self.data = data
        self.heading_title = heading_title
        self.add_sandbox_warning = add_sandbox_warning

    def cell_height(self, font_size: float | None = None) -> float:
        font_size = font_size or self.base_font_size
        return font_size * 0.35 * self.line_height_percentage

    def header(self) -> None:
        if self.add_sandbox_warning:
            self.set_xy(0, 0)
            self.set_fill_color(239, 177, 0)
            self.cell(
                self.w,
                10,
                "SANDBOX ENVIRONMENT: This invoice is for testing purposes only. No actual payment has been processed.",
                align=Align.C,
                fill=True,
            )
            self.ln(10)

    def footer(self) -> None:
        # Position footer at 15mm from bottom
        self.set_y(-self.b_margin)
        self.set_font(size=self.footer_font_size)
        # Invoice number on the left
        self.cell(self.epw / 2, 10, f"{self.data.number}", align=Align.L)
        # Page number on the right
        self.cell(self.epw / 2, 10, f"Page {self.page_no()} of {{nb}}", align=Align.R)

    def generate(self) -> None:
        self.set_metadata()
        self.add_page()

        # Title
        self.set_font(style="B", size=18)
        self.cell(
            text=self.heading_title,
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )

        # Logo on top right
        self.image(str(self.logo), x=Align.R, y=10, w=15)

        self.set_y(self.get_y() + self.elements_y_margin)

        # Heading items
        label_width = 30
        self.set_font(size=self.base_font_size)
        for heading_item in self.data.heading_items:
            self.set_font(style="B")
            self.cell(
                label_width, self.cell_height(), text=heading_item.label, align=Align.L
            )
            self.set_font(style="")
            self.cell(
                h=self.cell_height(),
                text=heading_item.display_value,
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
            )

        # Billing addresses
        self.set_y(self.get_y() + self.elements_y_margin)
        addresses_y_start = self.get_y()

        # Seller on left column
        self.set_font(style="B")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self.data.seller_name,
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_font(style="")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self.data.seller_address.to_text(),
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        if self.data.seller_additional_info:
            self.multi_cell(
                80,
                self.cell_height(),
                text=self.data.seller_additional_info,
                markdown=True,
            )
        left_seller_end_y = self.get_y()

        # Customer on right column
        self.set_xy(110, addresses_y_start)
        self.set_font(style="B")
        self.cell(
            h=self.cell_height(), text="Bill to", new_x=XPos.LEFT, new_y=YPos.NEXT
        )
        self.set_font(style="B")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self.data.customer_name,
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        self.set_font(style="")
        self.multi_cell(
            80,
            self.cell_height(),
            self.data.customer_address.to_text(),
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        if self.data.customer_additional_info:
            self.multi_cell(
                80,
                self.cell_height(),
                text=self.data.customer_additional_info,
                markdown=True,
            )
        right_seller_end_y = self.get_y()
        bottom = max(left_seller_end_y, right_seller_end_y)

        # Add spacing before table
        self.set_y(bottom + self.elements_y_margin)

        # Invoice items table
        self.set_draw_color(*self.table_borders_color)  # Light grey color for borders
        with self.table(
            col_widths=(90, 30, 30, 30),
            text_align=(Align.L, Align.R, Align.R, Align.R),
            headings_style=FontFace(size_pt=self.table_header_font_size),
            line_height=self.items_table_row_height,
            borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        ) as table:
            # Header
            header = table.row()
            header.cell("Description")
            header.cell("Quantity")
            header.cell("Unit Price")
            header.cell("Amount")

            # Body
            for item in self.data.items:
                row = table.row()
                row.cell(item.description)
                row.cell(format_number(item.quantity))
                row.cell(format_currency(item.unit_amount, self.data.currency))
                row.cell(format_currency(item.amount, self.data.currency))

        # Add totals section after the table
        self.set_y(self.get_y() + self.elements_y_margin)

        # Create a table for totals
        with self.table(
            col_widths=(150, 30),
            text_align=(Align.R, Align.R),
            first_row_as_headings=False,
            line_height=self.totals_table_row_height,
            borders_layout=TableBordersLayout.NONE,
        ) as totals_table:
            for total_item in self.data.totals_items:
                self.set_font(style="B")
                row = totals_table.row()
                row.cell(total_item.label)
                self.set_font(style="")
                row.cell(format_currency(total_item.amount, total_item.currency))

        # Add notes section
        self.set_font(style="")
        if self.data.notes:
            self.set_xy(self.l_margin, self.get_y() + self.elements_y_margin)
            self.multi_cell(
                w=0,
                h=self.cell_height(),
                text=self.data.notes,
                markdown=True,
            )

    def set_metadata(self) -> None:
        """Set metadata for the PDF document."""
        self.set_title(f"Invoice {self.data.number}")
        self.set_creator("Polar")
        self.set_author(settings.INVOICES_NAME)
        self.set_creation_date(utc_now())


__all__ = ["Invoice", "InvoiceGenerator", "InvoiceItem"]
