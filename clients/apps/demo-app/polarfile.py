from polar.config import (
    BenefitSet,
    Config,
    Credits,
    Fixed,
    Flag,
    Free,
    Meter,
    Metered,
    MeterSet,
    Product,
    ProductSet,
    Seats,
    Tier,
    Units,
    eur,
    per_thousand,
    usd,
)


class Meters(MeterSet):
    tool_call = Meter("Tool calls!", on="tool_call", unit="custom", label="tool calls")


class Benefits(BenefitSet):
    custom_servers = Flag("Custom servers", metadata={"tag": "primary"})
    tool_calls = Credits("Included tool calls", meter=Meters.tool_call, units=1200)
    free_tool_calls = Credits("Free tool calls", meter=Meters.tool_call, units=5)
    topup_100 = Credits(
        "100 extra tool calls", meter=Meters.tool_call, units=100, rollover=True
    )
    topup_500 = Credits(
        "500 extra tool calls", meter=Meters.tool_call, units=500, rollover=True
    )
    topup_1000 = Credits(
        "1,000 extra tool calls", meter=Meters.tool_call, units=1000, rollover=True
    )


class Products(ProductSet):
    free = Product(
        "Free", prices=[Free()], recurring="monthly", grants=[Benefits.free_tool_calls]
    )
    team = Product(
        "Team",
        prices=[
            Seats(
                graduated=[
                    Tier(max=5, amount=[usd(24), eur(18)]),
                    Tier(max=10, amount=[usd(18), eur(12)]),
                    Tier(amount=[usd(15), eur(14)]),
                ],
                min=1,
            )
        ],
        recurring="monthly",
        grants=[Benefits.custom_servers],
    )
    servers = Product(
        "Servers",
        prices=[
            Units(
                volume=[
                    Tier(max=10, amount=[usd(19), eur(14)]),
                    Tier(amount=[usd(8), eur(7)]),
                ],
                min=2,
                label=("server", "servers"),
            )
        ],
        recurring="monthly",
    )
    usage = Product(
        "Usage",
        prices=[
            Metered(
                Meters.tool_call,
                graduated=[
                    Tier(included=1000),
                    Tier(
                        max=10000, amount=[per_thousand(usd(2)), per_thousand(eur(1.8))]
                    ),
                    Tier(amount=[per_thousand(usd(1)), per_thousand(eur(0.9))]),
                ],
                cap=[usd(200), eur(180)],
            )
        ],
        recurring="monthly",
    )
    pro = Product(
        "Pro",
        prices=[
            Fixed([usd(99.99), eur(299.99)]),
            Metered(
                Meters.tool_call,
                amount=[per_thousand(usd(1)), per_thousand(eur(0.9))],
                cap=[usd(100), eur(90)],
            ),
        ],
        recurring="monthly",
        grants=[Benefits.custom_servers, Benefits.tool_calls],
    )
    topup_100 = Product(
        "100 tool calls",
        prices=[Fixed([usd(9), eur(5)], tax="inclusive")],
        grants=[Benefits.topup_100],
    )
    topup_500 = Product(
        "500 tool calls",
        prices=[Fixed([usd(39), eur(30)], tax="exclusive")],
        grants=[Benefits.topup_500],
    )
    topup_1000 = Product(
        "1,000 tool calls",
        prices=[Fixed([usd(79), eur(50)], tax="location")],
        grants=[Benefits.topup_1000],
    )


config = Config(meters=Meters, benefits=Benefits, products=Products)
