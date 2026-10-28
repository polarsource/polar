import pytest

from polar.checkout.payment_methods import (
    PaymentMethodRule,
    PaymentMode,
    get_payment_method_types,
    get_payment_mode,
)


@pytest.mark.parametrize(
    ("is_payment_required", "is_payment_setup_required", "expected"),
    [
        (True, False, "payment"),
        (True, True, "subscription"),
        (False, True, "setup"),
        (False, False, "setup"),
    ],
)
def test_get_payment_mode(
    is_payment_required: bool, is_payment_setup_required: bool, expected: PaymentMode
) -> None:
    assert (
        get_payment_mode(
            is_payment_required=is_payment_required,
            is_payment_setup_required=is_payment_setup_required,
        )
        == expected
    )


@pytest.mark.parametrize(
    ("mode", "country", "currency", "expected"),
    [
        ("payment", None, "usd", ["card"]),
        ("payment", "US", "usd", ["card"]),
        ("payment", "BE", "eur", ["card", "bancontact"]),
        ("payment", "BE", "usd", ["card"]),
        ("payment", "NL", "eur", ["card"]),
        ("subscription", "BE", "eur", ["card"]),
        ("setup", "BE", "eur", ["card"]),
    ],
)
def test_get_payment_method_types(
    mode: PaymentMode, country: str | None, currency: str, expected: list[str]
) -> None:
    assert (
        get_payment_method_types(
            mode=mode, country=country, currency=currency, amount=1000
        )
        == expected
    )


@pytest.mark.parametrize(
    ("mode", "amount", "expected"),
    [
        ("payment", 99, False),
        ("payment", 100, True),
        ("payment", 10_001, False),
        ("setup", 0, True),
    ],
)
def test_payment_method_rule_amount_limits(
    mode: PaymentMode, amount: int, expected: bool
) -> None:
    rule = PaymentMethodRule(amount_limits={"eur": (100, 10_000)})

    assert (
        rule.is_available(mode=mode, country="BE", currency="eur", amount=amount)
        is expected
    )
