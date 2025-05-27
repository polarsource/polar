from datetime import date, datetime
from pathlib import Path
from typing import Self

import pycountry
from babel.dates import format_date as _format_date
from babel.numbers import format_currency as _format_currency
from babel.numbers import format_number as _format_number
from babel.numbers import format_percent as _format_percent
from fontTools.misc.configTools import ClassVar
from fpdf import FPDF
from fpdf.enums import Align, TableBordersLayout, XPos, YPos
from fpdf.fonts import FontFace
from pydantic import BaseModel
from pydantic_extra_types.country import CountryAlpha2

from polar.kit.address import Address
from polar.kit.tax import TaxabilityReason, TaxRate
from polar.models import Order


def format_currency(amount: int, currency: str) -> str:
    return _format_currency(amount / 100, currency.upper(), locale="en_US")


def format_number(n: int) -> str:
    return _format_number(n, locale="en_US")


def format_percent(basis_points: int) -> str:
    return _format_percent(basis_points / 10000, locale="en_US")


def format_date(date: date | datetime) -> str:
    return _format_date(date, format="long", locale="en_US")


class InvoiceItem(BaseModel):
    description: str
    quantity: int
    unit_amount: int
    amount: int


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
    discount_amount: int
    taxability_reason: TaxabilityReason | None
    tax_amount: int
    tax_rate: TaxRate | None
    currency: str
    items: list[InvoiceItem]
    notes: str | None = None

    @property
    def formatted_subtotal_amount(self) -> str:
        return format_currency(self.subtotal_amount, self.currency)

    @property
    def formatted_discount_amount(self) -> str:
        return format_currency(-self.discount_amount, self.currency)

    @property
    def formatted_tax_amount(self) -> str:
        return format_currency(self.tax_amount, self.currency)

    @property
    def formatted_total_amount(self) -> str:
        total = self.subtotal_amount - self.discount_amount + self.tax_amount
        return format_currency(total, self.currency)

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

    @classmethod
    def from_order(cls, order: Order) -> Self:
        # TODO: proper error
        assert order.billing_name is not None, "Order must have a billing name"
        assert order.billing_address is not None, "Order must have a billing address"

        return cls(
            number=str(order.id),  # TODO
            date=order.created_at,
            seller_name="Polar Software Inc",  # TODO: in settings
            seller_address=Address(  # TODO: in settings
                line1="123 Polar St",
                city="San Francisco",
                state="CA",
                postal_code="94103",
                country=CountryAlpha2("US"),
            ),
            customer_name=order.billing_name,
            customer_address=order.billing_address,
            subtotal_amount=order.subtotal_amount,
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

    def __init__(self, data: Invoice) -> None:
        super().__init__()

        self.add_font(self.font_name, fname=self.regular_font_file)
        self.add_font(self.font_name, fname=self.bold_font_file, style="B")
        self.set_font(self.font_name, size=self.base_font_size)

        self.alias_nb_pages()
        self.data = data

    def cell_height(self, font_size: float | None = None) -> float:
        font_size = font_size or self.base_font_size
        return font_size * 0.35 * self.line_height_percentage

    def footer(self) -> None:
        # Position footer at 15mm from bottom
        self.set_y(-self.b_margin)
        self.set_font(size=self.footer_font_size)
        # Invoice number on the left
        self.cell(self.epw / 2, 10, f"{self.data.number}", align=Align.L)
        # Page number on the right
        self.cell(self.epw / 2, 10, f"Page {self.page_no()} of {{nb}}", align=Align.R)

    def generate(self) -> None:
        self.add_page()

        # Title
        self.set_font(style="B", size=18)
        self.cell(
            text="Invoice",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )

        # Logo on top right
        self.image(str(self.logo), x=Align.R, y=10, w=15)

        self.set_y(self.get_y() + self.elements_y_margin)

        # Invoice number and date
        label_width = 30
        self.set_font(size=self.base_font_size)
        self.set_font(style="B")
        self.cell(label_width, self.cell_height(), text="Invoice number", align=Align.L)
        self.set_font(style="")
        self.cell(
            h=self.cell_height(),
            text=self.data.number,
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )

        self.set_font(style="B")
        self.cell(label_width, self.cell_height(), text="Date of issue", align=Align.L)
        self.set_font(style="")
        self.cell(
            h=self.cell_height(),
            text=format_date(self.data.date),
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )

        # Billing addresses
        self.set_y(self.get_y() + self.elements_y_margin)
        addresses_y_start = self.get_y()

        # Seller on left column
        self.set_font(style="B")
        self.cell(
            h=self.cell_height(),
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

        # Customer on right column
        self.set_xy(110, addresses_y_start)
        self.set_font(style="B")
        self.cell(
            h=self.cell_height(), text="Bill to", new_x=XPos.LEFT, new_y=YPos.NEXT
        )
        self.set_font(style="B")
        self.cell(
            h=self.cell_height(),
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

        # Add spacing before table
        self.set_y(self.get_y() + self.elements_y_margin)

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
            # Subtotal row
            self.set_font(style="B")
            subtotal_row = totals_table.row()
            subtotal_row.cell("Subtotal")
            self.set_font(style="")
            subtotal_row.cell(self.data.formatted_subtotal_amount)

            # Discount row (only if discount amount > 0)
            if self.data.discount_amount > 0:
                self.set_font(style="B")
                discount_row = totals_table.row()
                discount_row.cell("Discount")
                self.set_font(style="")
                discount_row.cell(self.data.formatted_discount_amount)

            # Tax row
            if self.data.tax_displayed:
                self.set_font(style="B")
                tax_row = totals_table.row()
                tax_row.cell(self.data.tax_label)
                self.set_font(style="")
                tax_row.cell(self.data.formatted_tax_amount)

            # Total row
            self.set_font(style="B")
            total_row = totals_table.row()
            total_row.cell("Total")
            total_row.cell(self.data.formatted_total_amount)

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


__all__ = ["InvoiceGenerator", "Invoice", "InvoiceItem"]
