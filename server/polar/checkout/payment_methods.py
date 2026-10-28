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


PAYMENT_METHOD_RULES: dict[str, PaymentMethodRule] = {
    "card": PaymentMethodRule(),
    "bancontact": PaymentMethodRule(
        countries=frozenset({"BE"}),
        currencies=frozenset({"eur"}),
        reusable=False,
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
