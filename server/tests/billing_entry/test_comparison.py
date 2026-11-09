from decimal import Decimal

from polar.billing_entry.comparison import Adjustment, Quantities, explain


def test_explain() -> None:
    reducer = Quantities(usage=Decimal(100), credits=Decimal(30), net=Decimal(70))

    assert explain(reducer, {}) == reducer
    assert explain(
        reducer,
        {
            "usage": Adjustment(usage=Decimal(-10)),
            "credits": Adjustment(credits=Decimal(20)),
            "net": Adjustment(net=Decimal(5)),
        },
    ) == Quantities(usage=Decimal(90), credits=Decimal(50), net=Decimal(45))
