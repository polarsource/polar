import json
import pathlib
import subprocess
import sys

import pytest

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
    PaymentSettings,
    Product,
    ProductSet,
    Seats,
    SettingsSet,
    Tier,
    Units,
    Webhook,
    WebhookSet,
    eq,
    eur,
    jpy,
    per_thousand,
    usd,
)
from polar.config.money import unit_amount
from polar.config.prices import price_configs, price_currencies


def run_module(
    directory: pathlib.Path, source: str
) -> subprocess.CompletedProcess[str]:
    file = directory / "polarfile.py"
    file.write_text(source)
    return subprocess.run(
        [sys.executable, "-m", "polar.config", str(file)],
        check=False,
        capture_output=True,
        text=True,
        cwd=directory,
    )


class Meters(MeterSet):
    tool_call = Meter("Tool calls", on="tool_call", unit="custom", label="tool calls")


class Benefits(BenefitSet):
    custom_servers = Flag("Custom servers", metadata={"tag": "primary"})
    topup = Credits("Extra calls", meter=Meters.tool_call, units=100, rollover=True)


def test_config_compiles_to_the_json_the_api_accepts() -> None:
    assert json.loads(Config(meters=Meters, benefits=Benefits).to_json()) == {
        "meters": [
            {
                "external_id": "tool_call",
                "name": "Tool calls",
                "filter": {
                    "conjunction": "and",
                    "clauses": [
                        {"property": "name", "operator": "eq", "value": "tool_call"}
                    ],
                },
                "aggregation": {"func": "count"},
                "unit": "custom",
                "custom_label": "tool calls",
            }
        ],
        "benefits": [
            {
                "type": "feature_flag",
                "external_id": "custom_servers",
                "description": "Custom servers",
                "metadata": {"tag": "primary"},
            },
            {
                "type": "meter_credit",
                "external_id": "topup",
                "description": "Extra calls",
                "properties": {"meter": "tool_call", "units": 100, "rollover": True},
            },
        ],
    }


def test_attribute_names_become_external_ids_unless_overridden() -> None:
    class Usage(MeterSet):
        calls = Meter(on="call")
        legacy = Meter(on="old", external_id="legacy-meter")

    assert [meter.id for meter in Usage.definitions()] == ["calls", "legacy-meter"]
    assert Config(meters=Usage).to_dict()["meters"][0]["name"] == "calls"


def test_sets_reject_anything_but_their_definitions() -> None:
    with pytest.raises(TypeError, match="Usage.calls must be a Meter, got str"):

        class Usage(MeterSet):
            calls = "tool_call"


def test_meters_aggregate_one_property_and_narrow_with_where() -> None:
    tokens = Meter("Tokens", on="tool_call", where=eq("success", True), sum="tokens")
    assert tokens.aggregation == {"func": "sum", "property": "tokens"}
    assert tokens.filter == {
        "conjunction": "and",
        "clauses": [
            {"property": "name", "operator": "eq", "value": "tool_call"},
            {"property": "success", "operator": "eq", "value": True},
        ],
    }
    with pytest.raises(ValueError, match="only one of sum, max"):
        Meter("Bad", on="x", sum="a", max="b")


def test_short_attribute_names_need_a_name() -> None:
    class Usage(MeterSet):
        ok = Meter(on="x")

    with pytest.raises(ValueError, match='Provide a name for meter "ok"'):
        Config(meters=Usage)


def test_references_must_be_declared_and_not_deprecated() -> None:
    stray = Meter("Stray", on="x")
    with pytest.raises(ValueError, match="not declared in a set"):
        Config(
            benefits=type(
                "B", (BenefitSet,), {"c": Credits("Calls", meter=stray, units=1)}
            )
        )

    class Old(MeterSet):
        old = Meter("Old meter", on="x", deprecated=True)

    class Perks(BenefitSet):
        calls = Credits("Calls", meter=Old.old, units=1)

    with pytest.raises(ValueError, match="is deprecated"):
        Config(meters=Old, benefits=Perks)


def test_money_is_written_in_major_units() -> None:
    assert usd(99.99).amount == 9999
    assert usd("0.5").amount == 50
    assert jpy(500).amount == 500
    assert per_thousand(usd(1)).per == 1000
    assert unit_amount(per_thousand(usd(2))) == "0.2"
    with pytest.raises(ValueError, match="at most 2 decimals"):
        usd(0.381)
    with pytest.raises(ValueError, match="whole numbers"):
        jpy(1.5)


def test_prices_expand_to_one_api_price_per_currency() -> None:
    fixed = Fixed([usd(9), eur(5)], tax="inclusive")
    assert price_currencies(fixed, "p") == ["usd", "eur"]
    assert price_configs(fixed, ["usd", "eur"], "p") == [
        {
            "amount_type": "fixed",
            "price_currency": "usd",
            "price_amount": 900,
            "tax_behavior": "inclusive",
        },
        {
            "amount_type": "fixed",
            "price_currency": "eur",
            "price_amount": 500,
            "tax_behavior": "inclusive",
        },
    ]
    seats = Seats(graduated=[Tier(max=5, amount=usd(24)), Tier(amount=usd(15))], min=1)
    assert price_configs(seats, ["usd"], "p") == [
        {
            "amount_type": "seat_based",
            "price_currency": "usd",
            "minimum_units": 1,
            "tiers": {
                "type": "graduated",
                "tiers": [{"bound": 5, "unit_amount": "2400"}, {"unit_amount": "1500"}],
            },
        }
    ]
    usage = Metered(
        Meters.tool_call,
        graduated=[Tier(included=1000), Tier(amount=per_thousand(usd(2)))],
        cap=usd(200),
    )
    assert price_configs(usage, ["usd"], "p") == [
        {
            "amount_type": "metered_tiers",
            "price_currency": "usd",
            "meter": "tool_call",
            "cap_amount": 20000,
            "tiers": {
                "type": "graduated",
                "tiers": [{"bound": 1000, "unit_amount": "0"}, {"unit_amount": "0.2"}],
            },
        }
    ]
    flat = Metered(Meters.tool_call, amount=usd(1))
    assert price_configs(flat, ["usd"], "p") == [
        {
            "amount_type": "metered_unit",
            "price_currency": "usd",
            "meter": "tool_call",
            "unit_amount": "100",
        }
    ]
    servers = Units(
        volume=[Tier(max=10, amount=usd(19)), Tier(amount=usd(8))],
        min=2,
        label=("server", "servers"),
    )
    assert price_configs(servers, ["usd"], "p") == [
        {
            "amount_type": "unit_based",
            "price_currency": "usd",
            "minimum_units": 2,
            "unit_label": {"en": {"=1": "server", "other": "servers"}},
            "tiers": {
                "type": "volume",
                "tiers": [{"bound": 10, "unit_amount": "1900"}, {"unit_amount": "800"}],
            },
        }
    ]


def test_prices_take_amounts_or_tiers_not_both() -> None:
    with pytest.raises(ValueError, match="exactly one of them"):
        Seats(usd(10), graduated=[Tier(amount=usd(10))])
    with pytest.raises(ValueError, match="no included units"):
        Units(volume=[Tier(included=10), Tier(amount=usd(1))])
    with pytest.raises(ValueError, match="increasing tier bounds"):
        price_configs(
            Seats(graduated=[Tier(max=5, amount=usd(1)), Tier(max=3, amount=usd(1))]),
            ["usd"],
            "p",
        )
    with pytest.raises(ValueError, match="same currencies"):
        price_currencies(
            Seats(graduated=[Tier(max=5, amount=usd(1)), Tier(amount=eur(1))]), "p"
        )


def test_products_compile_with_their_prices_cycles_and_grants() -> None:
    class Products(ProductSet):
        free = Product(
            "Free",
            prices=[Free()],
            recurring="monthly",
            grants=[Benefits.custom_servers],
        )
        team = Product(
            "Team",
            prices=[Seats(usd(24), min=1)],
            recurring=(3, "months"),
            trial=(14, "days"),
        )
        topup = Product(
            "100 calls",
            prices=[Fixed(usd(9), tax="inclusive")],
            grants=[Benefits.topup],
        )

    assert Config(meters=Meters, benefits=Benefits, products=Products).to_dict()[
        "products"
    ] == [
        {
            "external_id": "free",
            "name": "Free",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "prices": [
                {"amount_type": "fixed", "price_currency": "usd", "price_amount": 0}
            ],
            "benefits": ["custom_servers"],
        },
        {
            "external_id": "team",
            "name": "Team",
            "recurring_interval": "month",
            "recurring_interval_count": 3,
            "trial_interval": "day",
            "trial_interval_count": 14,
            "prices": [
                {
                    "amount_type": "seat_based",
                    "price_currency": "usd",
                    "minimum_units": 1,
                    "tiers": {"type": "volume", "tiers": [{"unit_amount": "2400"}]},
                }
            ],
            "benefits": [],
        },
        {
            "external_id": "topup",
            "name": "100 calls",
            "prices": [
                {
                    "amount_type": "fixed",
                    "price_currency": "usd",
                    "price_amount": 900,
                    "tax_behavior": "inclusive",
                }
            ],
            "benefits": ["topup"],
        },
    ]


def test_products_check_their_prices_and_references() -> None:
    class Mixed(ProductSet):
        plan = Product(
            "Plan", prices=[Fixed([usd(1), eur(1)]), Units(usd(2))], recurring="monthly"
        )

    with pytest.raises(ValueError, match="same currencies"):
        Config(products=Mixed)

    class OneTime(ProductSet):
        plan = Product("Plan", prices=[Metered(Meters.tool_call, amount=usd(1))])

    with pytest.raises(ValueError, match="one-time purchase"):
        Config(meters=Meters, products=OneTime)

    class Unknown(ProductSet):
        plan = Product("Plan", prices=[Free()], grants=[Benefits.topup])

    with pytest.raises(ValueError, match="not in the benefits passed to Config"):
        Config(meters=Meters, products=Unknown)

    with pytest.raises(ValueError, match="needs a recurring product"):
        Product("Plan", prices=[Free()], trial=(14, "days"))


def test_settings_compile_to_their_api_groups() -> None:
    class Settings(SettingsSet):
        payments = PaymentSettings(currency="eur")

    class Plans(ProductSet):
        free = Product("Free", prices=[Free()])

    config = Config(settings=Settings, products=Plans)
    assert config.to_dict()["settings"] == {"payments": {"currency": "eur"}}
    assert config.to_dict()["products"][0]["prices"][0]["price_currency"] == "eur"

    with pytest.raises(TypeError, match="Bad.notifications is not a settings group"):

        class Bad(SettingsSet):
            notifications = PaymentSettings()


def test_webhooks_compile_with_the_sdk_api_version() -> None:
    class Webhooks(WebhookSet):
        ops = Webhook(
            "https://hooks.slack.com/x", events=["order.paid"], format="slack"
        )

    assert Config(webhooks=Webhooks).to_dict()["webhooks"] == [
        {
            "external_id": "ops",
            "url": "https://hooks.slack.com/x",
            "format": "slack",
            "events": ["order.paid"],
            "api_version": "{{ latest_api_version }}",
        }
    ]
    with pytest.raises(ValueError, match="at least one event"):
        Webhook("https://example.com/hook", events=[])


def test_module_prints_the_config(tmp_path: pathlib.Path) -> None:
    ran = run_module(tmp_path, "from polar.config import Config\nconfig = Config()\n")

    assert ran.returncode == 0, ran.stderr
    assert json.loads(ran.stdout) == {"meters": []}


def test_module_explains_a_file_without_a_config(tmp_path: pathlib.Path) -> None:
    ran = run_module(tmp_path, "billing = {}\n")

    assert ran.returncode == 1
    assert "variable named `config`" in ran.stderr
