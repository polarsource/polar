from dataclasses import dataclass, field
from typing import Literal

PaymentMode = Literal["payment", "subscription", "setup"]


@dataclass(frozen=True)
class PaymentMethodRule:
    countries: frozenset[str] | None = None
    currencies: frozenset[str] | None = None
    reusable: bool = True
    amount_limits: dict[str, tuple[int, int]] = field(default_factory=dict)

    def is_available(
        self,
        *,
        mode: PaymentMode,
        country: str | None,
        currency: str,
        amount: int,
    ) -> bool:
        if self.countries is not None and country not in self.countries:
            return False
        if self.currencies is not None and currency not in self.currencies:
            return False
        if mode != "payment" and not self.reusable:
            return False
        if mode != "setup" and currency in self.amount_limits:
            minimum, maximum = self.amount_limits[currency]
            if not minimum <= amount <= maximum:
                return False
        return True


USD_WALLET_AMOUNT_LIMITS = {"usd": (50, 99_999_999)}
KRW_AMOUNT_LIMITS = {"krw": (675, 99_999_999)}
GREATER_CHINA = frozenset({"CN", "HK", "MO"})

PAYMENT_METHOD_RULES: dict[str, PaymentMethodRule] = {
    "card": PaymentMethodRule(),
    "link": PaymentMethodRule(),
    "amazon_pay": PaymentMethodRule(
        countries=frozenset({"US", "DE"}),
        currencies=frozenset({"usd"}),
        amount_limits=USD_WALLET_AMOUNT_LIMITS,
    ),
    "cashapp": PaymentMethodRule(
        countries=frozenset({"US"}),
        currencies=frozenset({"usd"}),
        amount_limits=USD_WALLET_AMOUNT_LIMITS,
    ),
    "kr_card": PaymentMethodRule(
        currencies=frozenset({"krw"}), amount_limits=KRW_AMOUNT_LIMITS
    ),
    "kakao_pay": PaymentMethodRule(
        currencies=frozenset({"krw"}), amount_limits=KRW_AMOUNT_LIMITS
    ),
    "naver_pay": PaymentMethodRule(
        currencies=frozenset({"krw"}), amount_limits=KRW_AMOUNT_LIMITS
    ),
    "samsung_pay": PaymentMethodRule(
        currencies=frozenset({"krw"}),
        reusable=False,
        amount_limits=KRW_AMOUNT_LIMITS,
    ),
    "alipay": PaymentMethodRule(
        countries=GREATER_CHINA,
        currencies=frozenset({"cny", "usd"}),
        reusable=False,
        amount_limits=USD_WALLET_AMOUNT_LIMITS,
    ),
    "wechat_pay": PaymentMethodRule(
        countries=GREATER_CHINA,
        currencies=frozenset({"cny", "usd"}),
        reusable=False,
        amount_limits=USD_WALLET_AMOUNT_LIMITS,
    ),
    "upi": PaymentMethodRule(
        currencies=frozenset({"inr"}), amount_limits={"inr": (4697, 10_000_000)}
    ),
    "bancontact": PaymentMethodRule(
        countries=frozenset({"BE"}),
        currencies=frozenset({"eur"}),
        reusable=False,
        amount_limits={"eur": (45, 99_999_999)},
    ),
    "eps": PaymentMethodRule(
        countries=frozenset({"AT"}),
        currencies=frozenset({"eur"}),
        reusable=False,
        amount_limits={"eur": (100, 99_999_999)},
    ),
    "ideal": PaymentMethodRule(
        countries=frozenset({"NL"}),
        currencies=frozenset({"eur"}),
        reusable=False,
        amount_limits={"eur": (1, 99_999_999)},
    ),
}


def get_payment_mode(
    *, is_payment_required: bool, is_payment_setup_required: bool
) -> PaymentMode:
    if is_payment_required:
        return "subscription" if is_payment_setup_required else "payment"
    return "setup"


def get_payment_method_types(
    *,
    mode: PaymentMode,
    country: str | None,
    currency: str,
    amount: int,
) -> list[str]:
    return [
        payment_method_type
        for payment_method_type, rule in PAYMENT_METHOD_RULES.items()
        if rule.is_available(
            mode=mode, country=country, currency=currency, amount=amount
        )
    ]
