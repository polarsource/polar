import datetime
import re
import zlib
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
        tax_amount=18_00,
        tax_breakdown=[
            {
                "rate_type": "percentage",
                "display_name": "VAT",
                "rate": 0.2,
                "country": "FR",
                "state": None,
                "subdivision": None,
                "amount": 18_00,
                "taxability_reason": TaxabilityReason.standard_rated,
            }
        ],
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
                "tax_amount": 540,
                "tax_breakdown": [
                    {
                        "rate": 0.05,
                        "amount": 500,
                        "country": "US",
                        "state": "TX",
                        "subdivision": None,
                        "rate_type": "percentage",
                        "display_name": "Sales Tax",
                        "taxability_reason": "standard_rated",
                    },
                    {
                        "rate": 0.004,
                        "amount": 40,
                        "country": "US",
                        "state": "TX",
                        "subdivision": "Bee",
                        "rate_type": "percentage",
                        "display_name": "Sales Tax",
                        "taxability_reason": "standard_rated",
                    },
                ],
            },
            "multiple_tax_breakdown",
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
        # Default invoice has a US customer, so the SC family is preferred
        # first; characters shared across scripts (Han) resolve to it. KR is
        # the only family with Hangul.
        sc_family = generator.cjk_font_name_for_script("sc")
        kr_family = generator.cjk_font_name_for_script("kr")
        assert generator.get_fallback_font("你") == sc_family
        assert generator.get_fallback_font("日") == sc_family
        assert generator.get_fallback_font("안") == kr_family
        assert generator.get_fallback_font("你", style="B") == f"{sc_family}B"
        assert generator.get_fallback_font("日", style="B") == f"{sc_family}B"
        assert generator.get_fallback_font("안", style="B") == f"{kr_family}B"


@pytest.mark.skipif(
    not InvoiceGenerator.has_cjk_fallback_fonts(),
    reason="CJK fallback fonts are not installed",
)
def test_generator_uses_traditional_chinese_for_tw_customer(invoice: Invoice) -> None:
    generator = InvoiceGenerator(
        invoice.model_copy(
            update={
                "customer_name": "範例股份有限公司",
                "customer_address": Address(
                    line1="123 Example St",
                    city="Taipei City",
                    postal_code="100",
                    country=CountryAlpha2("TW"),
                ),
                "items": [
                    InvoiceItem(
                        description="年度訂閱",
                        quantity=1,
                        unit_amount=100_00,
                        amount=100_00,
                    ),
                ],
            }
        )
    )

    tc_family = generator.cjk_font_name_for_script("tc")
    assert generator.get_fallback_font("範") == tc_family
    assert generator.get_fallback_font("範", style="B") == f"{tc_family}B"


@pytest.mark.skipif(
    not InvoiceGenerator.has_cjk_fallback_fonts(),
    reason="CJK fallback fonts are not installed",
)
def test_generator_locale_overrides_country_for_cjk_script(invoice: Invoice) -> None:
    generator = InvoiceGenerator(
        invoice.model_copy(
            update={
                "customer_name": "山田太郎",
                "customer_locale": "ja-JP",
                "customer_address": Address(
                    line1="123 Example St",
                    city="Taipei City",
                    postal_code="100",
                    country=CountryAlpha2("TW"),
                ),
            }
        )
    )

    jp_family = generator.cjk_font_name_for_script("jp")
    assert generator.get_fallback_font("山") == jp_family
    assert generator.get_fallback_font("山", style="B") == f"{jp_family}B"


@pytest.mark.parametrize(
    ("locale", "expected"),
    [
        (None, None),
        ("", None),
        ("en-US", None),
        ("ja", "jp"),
        ("ja-JP", "jp"),
        ("ko", "kr"),
        ("ko-KR", "kr"),
        ("zh", "sc"),
        ("zh-CN", "sc"),
        ("zh-Hans", "sc"),
        ("zh-SG", "sc"),
        ("zh-TW", "tc"),
        ("zh-HK", "tc"),
        ("zh-MO", "tc"),
        ("zh-Hant", "tc"),
        ("zh_TW", "tc"),
        ("ZH-tw", "tc"),
    ],
)
def test_cjk_script_from_locale(locale: str | None, expected: str | None) -> None:
    assert InvoiceGenerator.cjk_script_from_locale(locale) == expected


@pytest.mark.skipif(
    not InvoiceGenerator.has_cjk_fallback_fonts(),
    reason="CJK fallback fonts are not installed",
)
def test_generator_renders_amounts_in_primary_font_after_cjk(
    invoice: Invoice, tmp_path: Path
) -> None:
    """fpdf2's set_font short-circuits when family/style/size match, but
    current_font can drift to a fallback after a CJK fragment renders. The
    set_font override on InvoiceGenerator force-resolves current_font so
    subsequent ASCII cells (quantity, unit price, amount) render with Inter
    and not the CJK font that was used for the description.
    """
    generator = InvoiceGenerator(
        invoice.model_copy(
            update={
                "customer_name": "Yamada Taro",
                "customer_locale": "ja-JP",
                "customer_address": Address(
                    line1="1-1 Chiyoda",
                    city="Tokyo",
                    postal_code="100-0001",
                    country=CountryAlpha2("JP"),
                ),
                "currency": "jpy",
                "items": [
                    InvoiceItem(
                        description="年間プラン",
                        quantity=1,
                        unit_amount=10_000,
                        amount=10_000,
                    ),
                ],
            }
        )
    )
    generator.generate()
    path = tmp_path / "amounts.pdf"
    generator.output(str(path))

    raw = path.read_bytes()

    font_objs: dict[int, str] = {}
    for obj_match in re.finditer(rb"(\d+) 0 obj\b(.*?)endobj", raw, re.DOTALL):
        body = obj_match.group(2)
        if not re.search(rb"/Type\s*/Font\b", body):
            continue
        base_font = re.search(rb"/BaseFont\s*/([^\s/<>]+)", body)
        if base_font:
            font_objs[int(obj_match.group(1))] = base_font.group(1).decode()

    font_alias_to_basefont: dict[str, str] = {}
    for entry in re.finditer(rb"/(F\d+)\s+(\d+)\s+0\s+R", raw):
        alias = entry.group(1).decode()
        ref = int(entry.group(2))
        if ref in font_objs:
            font_alias_to_basefont.setdefault(alias, font_objs[ref])

    page_stream_match = re.search(rb"\b4 0 obj\b(.*?)endobj", raw, re.DOTALL)
    assert page_stream_match is not None
    obj_body = page_stream_match.group(1)
    stream_start = re.search(rb"stream\r?\n", obj_body)
    stream_end = obj_body.rfind(b"\nendstream")
    assert stream_start is not None
    assert stream_end > 0
    decompressed = zlib.decompress(obj_body[stream_start.end() : stream_end]).decode(
        "latin1", errors="replace"
    )

    cjk_basefont_substrings = ("NotoSansTC", "NotoSansSC", "NotoSansJP", "NotoSansKR")
    cjk_aliases = {
        alias
        for alias, base_font in font_alias_to_basefont.items()
        if any(token in base_font for token in cjk_basefont_substrings)
    }

    cjk_tf_ops = [
        tf_match.group(1)
        for tf_match in re.finditer(r"/(F\d+)\s+[\d.]+\s+Tf", decompressed)
        if tf_match.group(1) in cjk_aliases
    ]
    assert cjk_tf_ops, "Expected the CJK font to be used for the description cell"
    assert len(cjk_tf_ops) == 1, (
        f"Expected the CJK font to be selected exactly once (for the "
        f"description cell), but got {len(cjk_tf_ops)} Tf ops referencing "
        f"{cjk_tf_ops}. This means current_font drifted after the "
        f"description cell and amounts rendered in the CJK font."
    )
