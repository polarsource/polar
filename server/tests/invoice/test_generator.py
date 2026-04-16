import datetime
from pathlib import Path
from typing import Any

import pytest

from polar.invoice.generator import Invoice, InvoiceGenerator, InvoiceItem
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxabilityReason


@pytest.fixture
def invoice() -> Invoice:
    return Invoice(
        number="12345",
        date=datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.UTC),
        seller_name="Polar Software Inc",
        seller_address=Address(
            line1="123 Polar St",
            city="San Francisco",
            state="CA",
            postal_code="94107",
            country=CountryAlpha2("US"),
        ),
        seller_additional_info="[support@polar.sh](mailto:support@polar.sh)",
        customer_name="John Doe",
        customer_address=Address(
            line1="456 Customer Ave",
            city="Los Angeles",
            state="CA",
            postal_code="90001",
            country=CountryAlpha2("US"),
        ),
        customer_additional_info="FR61954506077",
        subtotal_amount=100_00,
        discount_amount=10_00,
        taxability_reason=TaxabilityReason.standard_rated,
        tax_amount=18_00,
        tax_rate={
            "rate_type": "percentage",
            "display_name": "VAT",
            "basis_points": 2000,
            "country": "FR",
            "amount": None,
            "amount_currency": None,
            "state": None,
        },
        net_amount=90_00,
        currency="usd",
        items=[
            InvoiceItem(
                description="SaaS Subscription",
                quantity=1,
                unit_amount=50_00,
                amount=50_00,
            ),
            InvoiceItem(
                description="Metered Usage",
                quantity=50,
                unit_amount=1_00,
                amount=50_00,
            ),
        ],
        notes=(
            """
Thank you for your business!

- [Legal terms](https://polar.sh) and conditions apply.
- Lawyers blah blah blah.
- This is a test invoice.
        """
        ),
    )


@pytest.mark.parametrize(
    ("overrides", "id"),
    [
        ({}, "basic"),
        (
            {
                "customer_name": "Super Long Company Name That Doesn't Fit On A Single Line"
            },
            "long_customer_name",
        ),
        (
            {
                "customer_address": Address(country=CountryAlpha2("FR")),
                "seller_additional_info": "[support@polar.sh](mailto:support@polar.sh)\nExtra line 1\nExtra line 2\nExtra line 3",
            },
            "long_seller_info",
        ),
        (
            {
                "items": [
                    InvoiceItem(
                        description="Bacon ipsum dolor amet flank venison swine, tenderloin ham hock turducken short loin bacon. Pork chop cupim turkey short ribs bacon rump picanha ham hock jerky salami ground round ham shoulder swine brisket. Ham hock pork chop chislic cow hamburger tongue beef. Jerky pastrami biltong pancetta. Ground round chuck meatloaf jowl. Tongue short ribs boudin jowl, frankfurter sausage meatloaf short loin tail burgdoggen flank.Bacon ipsum dolor amet flank venison swine, tenderloin ham hock turducken short loin bacon. Pork chop cupim turkey short ribs bacon rump picanha ham hock jerky salami ground round ham shoulder swine brisket. Ham hock pork chop chislic cow hamburger tongue beef. Jerky pastrami biltong pancetta. Ground round chuck meatloaf jowl. Tongue short ribs boudin jowl, frankfurter sausage meatloaf short loin tail burgdoggen flank."
                        * 100,
                        quantity=1,
                        unit_amount=50_00,
                        amount=50_00,
                    ),
                ],
            },
            "long_item_description",
        ),
        (
            {
                "customer_name": "Văn bản thử nghiệm tiếng Việt",
                "customer_address": Address(
                    line1="Số 42, Đồi Mây Trắng",
                    city="Phường Gió Mới",
                    country=CountryAlpha2("VN"),
                ),
            },
            "unicode_vietnamese",
        ),
        (
            {
                "customer_name": "שלום עולם",
                "customer_address": Address(
                    line1="רחוב הרצל 1",
                    city="תל אביב",
                    postal_code="61000",
                    country=CountryAlpha2("IL"),
                ),
                "customer_additional_info": "עוסק מורשה 123456789",
                "items": [
                    InvoiceItem(
                        description="מנוי שנתי",
                        quantity=1,
                        unit_amount=50_00,
                        amount=50_00,
                    ),
                    InvoiceItem(
                        description="שימוש נוסף",
                        quantity=2,
                        unit_amount=25_00,
                        amount=50_00,
                    ),
                ],
                "notes": "תודה על הרכישה",
            },
            "unicode_hebrew",
        ),
        (
            {
                "customer_name": "شركة السلام",
                "customer_address": Address(
                    line1="١٢٣ شارع النيل",
                    city="القاهرة",
                    postal_code="11511",
                    country=CountryAlpha2("EG"),
                ),
                "customer_additional_info": "رقم ضريبي ١٢٣٤٥٦٧٨٩",
                "items": [
                    InvoiceItem(
                        description="اشتراك سنوي",
                        quantity=1,
                        unit_amount=75_00,
                        amount=75_00,
                    ),
                    InvoiceItem(
                        description="رسوم إضافية",
                        quantity=1,
                        unit_amount=25_00,
                        amount=25_00,
                    ),
                ],
                "notes": "شكرًا لثقتكم",
            },
            "unicode_arabic",
        ),
        pytest.param(
            {
                "customer_name": "你好 안녕하세요 日本語",
                "customer_address": Address(
                    line1="静安区南京西路 123 号",
                    city="서울",
                    postal_code="04524",
                    country=CountryAlpha2("KR"),
                ),
                "customer_additional_info": "顧客番号 12345",
                "items": [
                    InvoiceItem(
                        description="年間プラン",
                        quantity=1,
                        unit_amount=40_00,
                        amount=40_00,
                    ),
                    InvoiceItem(
                        description="추가 사용량",
                        quantity=2,
                        unit_amount=30_00,
                        amount=60_00,
                    ),
                ],
                "notes": "谢谢 / 감사합니다 / ありがとうございます",
            },
            "unicode_cjk",
            marks=pytest.mark.skipif(
                not InvoiceGenerator.has_cjk_fallback_fonts(),
                reason="CJK fallback fonts are not installed",
            ),
        ),
    ],
)
def test_generator(overrides: dict[str, Any], id: str, invoice: Invoice) -> None:
    path = Path(__file__).parent / f"test_invoice_{id}.pdf"
    path.unlink(missing_ok=True)

    generator = InvoiceGenerator(invoice.model_copy(update=overrides))
    generator.generate()
    generator.output(str(path))

    assert path.exists()


def test_generator_registers_unicode_fallback_fonts(invoice: Invoice) -> None:
    generator = InvoiceGenerator(
        invoice.model_copy(
            update={
                "customer_name": "שלום עולם",
                "items": [
                    InvoiceItem(
                        description="מנוי שנתי",
                        quantity=1,
                        unit_amount=100_00,
                        amount=100_00,
                    )
                ],
            }
        )
    )

    assert generator.text_shaping is None
    assert generator.get_fallback_font("ש") == generator.hebrew_font_name
    assert generator.get_fallback_font("ש", style="B") == (
        f"{generator.hebrew_font_name}B"
    )
    assert generator.get_fallback_font("م") == generator.arabic_font_name
    assert generator.get_fallback_font("م", style="B") == (
        f"{generator.arabic_font_name}B"
    )
    if InvoiceGenerator.has_cjk_fallback_fonts():
        assert generator.get_fallback_font("你") == generator.cjk_font_name
        assert generator.get_fallback_font("안") == generator.cjk_font_name
        assert generator.get_fallback_font("日") == generator.cjk_font_name
        assert generator.get_fallback_font("你", style="B") == (
            f"{generator.cjk_font_name}B"
        )
        assert generator.get_fallback_font("안", style="B") == (
            f"{generator.cjk_font_name}B"
        )
        assert generator.get_fallback_font("日", style="B") == (
            f"{generator.cjk_font_name}B"
        )
