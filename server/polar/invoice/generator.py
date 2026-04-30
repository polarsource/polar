import textwrap
from datetime import date, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar, Self

import arabic_reshaper
import pycountry
from babel.dates import format_date as _format_date
from babel.numbers import format_decimal as _format_decimal
from babel.numbers import format_percent as _format_percent
from bidi.algorithm import get_display
from fpdf import FPDF
from fpdf.enums import Align, TableBordersLayout, TextEmphasis, XPos, YPos
from fpdf.fonts import FontFace
from pydantic import BaseModel

from polar.config import Environment, settings
from polar.kit.address import Address
from polar.kit.currency import format_currency
from polar.kit.utils import utc_now
from polar.tax.calculation.base import TaxabilityReason, TaxBreakdownItem

if TYPE_CHECKING:
    from polar.models import Order


def format_number(n: int) -> str:
    return _format_decimal(n, locale="en_US")


def format_percent(rate: float) -> str:
    return _format_percent(
        rate,
        locale="en_US",
        decimal_quantization=False,  # Don't truncate very small rates
    )


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
    customer_locale: str | None = None
    subtotal_amount: int
    applied_balance_amount: int | None = None
    discount_amount: int
    tax_amount: int
    tax_breakdown: list[TaxBreakdownItem] = []
    net_amount: int
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
    def tax_items(self) -> list[InvoiceTotalsItem]:
        items: list[InvoiceTotalsItem] = []
        for item in self.tax_breakdown:
            if item["taxability_reason"] not in {
                TaxabilityReason.standard_rated,
                TaxabilityReason.reverse_charge,
            }:
                continue

            label = item["display_name"]

            if item["taxability_reason"] == TaxabilityReason.reverse_charge:
                label = f"{label} (0% Reverse Charge)"
            else:
                if item["country"] is not None:
                    country = pycountry.countries.get(alpha_2=item["country"])
                    if country is not None:
                        parts = [country.name]

                        if item["state"] is not None:
                            state: Any | None = pycountry.subdivisions.get(
                                code=f"{item['country']}-{item['state']}"
                            )
                            if state is not None:
                                parts = [state.name] + parts

                        if item["subdivision"] is not None:
                            parts = [item["subdivision"]] + parts

                        label += f" — {', '.join(parts)}"

                if item["rate"] is not None:
                    label += f" ({format_percent(item['rate'])})"

            items.append(
                InvoiceTotalsItem(
                    label=label,
                    amount=item["amount"],
                    currency=self.currency,
                )
            )

        if len(self.tax_breakdown) > 1:
            items.append(
                InvoiceTotalsItem(
                    label="Total tax",
                    amount=self.tax_amount,
                    currency=self.currency,
                )
            )

        return items

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

        tax_items = self.tax_items
        if len(tax_items) > 0:
            items.append(
                InvoiceTotalsItem(
                    label="Total excluding tax",
                    amount=self.net_amount,
                    currency=self.currency,
                )
            )
            items.extend(tax_items)

        total = self.net_amount + self.tax_amount
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
    def from_order(cls, order: "Order") -> Self:
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
        )


class InvoiceGenerator(FPDF):
    """Class to generate an invoice PDF using fpdf2."""

    logo: ClassVar[Path] = Path(__file__).parent / "invoice-logo.svg"
    """Path to the logo image for the invoice."""

    font_name: ClassVar[str] = "inter"
    """Default font family name."""

    hebrew_font_name: ClassVar[str] = "notosanshebrew"
    """Font family name for Hebrew fallback glyphs."""

    arabic_font_name: ClassVar[str] = "notosansarabic"
    """Font family name for Arabic fallback glyphs."""

    cjk_font_name_prefix: ClassVar[str] = "notosans"
    """Prefix used to derive the fpdf font family name for each CJK script."""

    cjk_scripts: ClassVar[tuple[str, ...]] = ("tc", "sc", "jp", "kr")
    """CJK script families we ship per-script TTFs for."""

    font_files: ClassVar[dict[str, tuple[Path, Path]]] = {
        font_name: (
            Path(__file__).parent / "fonts/Inter-Regular.ttf",
            Path(__file__).parent / "fonts/Inter-Bold.ttf",
        ),
        hebrew_font_name: (
            Path(__file__).parent / "fonts/NotoSansHebrew-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansHebrew-Bold.ttf",
        ),
        arabic_font_name: (
            Path(__file__).parent / "fonts/NotoSansArabic-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansArabic-Bold.ttf",
        ),
        # Per-script TTFs, not the unified TTC: PDF.js can't decode the CFF subsets fpdf2 emits.
        f"{cjk_font_name_prefix}tc": (
            Path(__file__).parent / "fonts/NotoSansTC-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansTC-Bold.ttf",
        ),
        f"{cjk_font_name_prefix}sc": (
            Path(__file__).parent / "fonts/NotoSansSC-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansSC-Bold.ttf",
        ),
        f"{cjk_font_name_prefix}jp": (
            Path(__file__).parent / "fonts/NotoSansJP-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansJP-Bold.ttf",
        ),
        f"{cjk_font_name_prefix}kr": (
            Path(__file__).parent / "fonts/NotoSansKR-Regular.ttf",
            Path(__file__).parent / "fonts/NotoSansKR-Bold.ttf",
        ),
    }
    """Font files (regular, bold) keyed by fpdf family name."""

    cjk_script_country_map: ClassVar[dict[str, str]] = {
        "JP": "jp",
        "KR": "kr",
        "CN": "sc",
        "SG": "sc",
        "MY": "sc",
        "TW": "tc",
        "MO": "tc",
        "HK": "tc",
    }
    """Map ISO 3166-1 alpha-2 country to the preferred CJK script family."""

    cjk_default_script: ClassVar[str] = "sc"
    """Default CJK script family when the customer's country is not mapped."""

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

    @classmethod
    def cjk_font_name_for_script(cls, script: str) -> str:
        return f"{cls.cjk_font_name_prefix}{script}"

    @classmethod
    def has_cjk_fallback_fonts(cls) -> bool:
        return all(
            p.exists()
            for s in cls.cjk_scripts
            for p in cls.font_files[cls.cjk_font_name_for_script(s)]
        )

    @classmethod
    def resolve_cjk_script(cls, country: str | None) -> str:
        if country is None:
            return cls.cjk_default_script
        return cls.cjk_script_country_map.get(country, cls.cjk_default_script)

    @classmethod
    def cjk_script_from_locale(cls, locale: str | None) -> str | None:
        if not locale:
            return None
        parts = locale.replace("_", "-").lower().split("-")
        language = parts[0]
        if language == "ja":
            return "jp"
        if language == "ko":
            return "kr"
        if language == "zh":
            for tag in parts[1:]:
                if tag in {"hant", "tw", "hk", "mo"}:
                    return "tc"
            return "sc"
        return None

    def __init__(
        self,
        data: Invoice,
        heading_title: str = "Invoice",
        add_sandbox_warning: bool = settings.ENV == Environment.sandbox,
    ) -> None:
        super().__init__()

        # To use a font we first add the font to fpdf, and then we set the
        # fallback order. Here we load all of the fonts. CJK fonts are
        # downloaded in the Dockerfile build stage and may be absent in
        # dev/CI, so skip any family whose files aren't present.
        self.loaded_font_families: set[str] = set()
        for family, (regular, bold) in self.font_files.items():
            if not (regular.exists() and bold.exists()):
                continue
            self.add_font(family, fname=regular)
            self.add_font(family, fname=bold, style="B")
            self.loaded_font_families.add(family)

        # Fallback order: Hebrew, Arabic, then CJK with the customer's script
        # first so shared Han chars get the right regional glyph form.
        # customer locale/country first, and then all other scripts.
        customer_script = self.cjk_script_from_locale(
            data.customer_locale
        ) or self.resolve_cjk_script(data.customer_address.country)

        fallback_fonts = [
            family
            for family in [
                self.hebrew_font_name,
                self.arabic_font_name,
                self.cjk_font_name_for_script(customer_script),
                *(
                    self.cjk_font_name_for_script(s)
                    for s in self.cjk_scripts
                    if s != customer_script
                ),
            ]
            if family in self.loaded_font_families
        ]
        self.set_fallback_fonts(fallback_fonts, exact_match=False)
        self.set_font(self.font_name, size=self.base_font_size)

        self.alias_nb_pages()
        self.data = data
        self.heading_title = heading_title
        self.add_sandbox_warning = add_sandbox_warning

    def set_font(
        self,
        family: str | None = None,
        style: str | TextEmphasis = "",
        size: float = 0,
    ) -> None:
        # fpdf2's set_font short-circuits when family/style/size match the
        # currently tracked values. But `current_font` can drift to a
        # fallback font during fragment rendering (fpdf.py sets
        # `current_font = frag.font` per fragment), so the next set_font call
        # for the same family is a no-op and `current_font` stays stale —
        # causing subsequent ASCII cells to render with the CJK font's
        # cmap. Re-resolve `current_font` from the canonical font_family +
        # font_style after delegating, so it always matches the logical
        # font selection.
        super().set_font(family, style, size)
        fontkey = self.font_family + self.font_style
        if fontkey in self.fonts:
            self.current_font = self.fonts[fontkey]

    def _shape_text(self, text: str) -> str:
        lines = text.split("\n")
        shaped = []
        for line in lines:
            reshaped = arabic_reshaper.reshape(line)
            shaped.append(get_display(reshaped))
        return "\n".join(shaped)

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
        self._render_title()
        self._render_heading_items()
        self._render_addresses()
        self._render_items_table()
        self._render_totals_table()
        self._render_notes()

    def _render_title(self) -> None:
        self.set_font(style="B", size=18)
        self.cell(
            text=self._shape_text(self.heading_title),
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.image(str(self.logo), x=Align.R, y=10, w=15)
        self.set_y(self.get_y() + self.elements_y_margin)

    def _render_heading_items(self) -> None:
        label_width = 30
        self.set_font(size=self.base_font_size)
        for heading_item in self.data.heading_items:
            self.set_font(style="B")
            self.cell(
                label_width,
                self.cell_height(),
                text=self._shape_text(heading_item.label),
                align=Align.L,
            )
            self.set_font(style="")
            self.cell(
                h=self.cell_height(),
                text=self._shape_text(heading_item.display_value),
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
            )

    def _render_addresses(self) -> None:
        self.set_y(self.get_y() + self.elements_y_margin)
        y_start = self.get_y()

        seller_end_y = self._render_seller_block()

        self.set_xy(110, y_start)
        customer_end_y = self._render_customer_block()

        self.set_y(max(seller_end_y, customer_end_y) + self.elements_y_margin)

    def _render_seller_block(self) -> float:
        self.set_font(style="B")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self._shape_text(self.data.seller_name),
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_font(style="")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self._shape_text(self.data.seller_address.to_text()),
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        if self.data.seller_additional_info:
            self.multi_cell(
                80,
                self.cell_height(),
                text=self._shape_text(self.data.seller_additional_info),
                markdown=True,
            )
        return self.get_y()

    def _render_customer_block(self) -> float:
        self.set_font(style="B")
        self.cell(
            h=self.cell_height(), text="Bill to", new_x=XPos.LEFT, new_y=YPos.NEXT
        )
        self.set_font(style="B")
        self.multi_cell(
            80,
            self.cell_height(),
            text=self._shape_text(self.data.customer_name),
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        self.set_font(style="")
        self.multi_cell(
            80,
            self.cell_height(),
            self._shape_text(self.data.customer_address.to_text()),
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )
        if self.data.customer_additional_info:
            self.multi_cell(
                80,
                self.cell_height(),
                text=self._shape_text(self.data.customer_additional_info),
                markdown=True,
            )
        return self.get_y()

    def _render_items_table(self) -> None:
        self.set_draw_color(*self.table_borders_color)  # Light grey color for borders
        with self.table(
            col_widths=(90, 30, 30, 30),
            text_align=(Align.L, Align.R, Align.R, Align.R),
            headings_style=FontFace(size_pt=self.table_header_font_size),
            line_height=self.items_table_row_height,
            borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        ) as table:
            header = table.row()
            header.cell("Description")
            header.cell("Quantity")
            header.cell("Unit Price")
            header.cell("Amount")

            for item in self.data.items:
                row = table.row()
                row.cell(
                    self._shape_text(
                        textwrap.shorten(item.description, width=90, placeholder="…")
                    )
                )
                row.cell(format_number(item.quantity))
                row.cell(format_currency(item.unit_amount, self.data.currency))
                row.cell(format_currency(item.amount, self.data.currency))

    def _render_totals_table(self) -> None:
        self.set_y(self.get_y() + self.elements_y_margin)
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
                row.cell(self._shape_text(total_item.label))
                self.set_font(style="")
                row.cell(format_currency(total_item.amount, total_item.currency))

    def _render_notes(self) -> None:
        self.set_font(style="")
        if self.data.notes:
            self.set_xy(self.l_margin, self.get_y() + self.elements_y_margin)
            self.multi_cell(
                w=0,
                h=self.cell_height(),
                text=self._shape_text(self.data.notes),
                markdown=True,
            )

    def set_metadata(self) -> None:
        """Set metadata for the PDF document."""
        self.set_title(f"Invoice {self.data.number}")
        self.set_creator("Polar")
        self.set_author(settings.INVOICES_NAME)
        self.set_creation_date(utc_now())


__all__ = ["Invoice", "InvoiceGenerator", "InvoiceItem"]
