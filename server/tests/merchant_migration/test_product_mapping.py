from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.importer import find_imported_price
from polar.merchant_migration.product_mapping import (
    UNSET,
    decide_mapping,
    incompatibilities,
    is_compatible,
    read_product_mappings,
    serialize_product_mappings,
    subscriber_counts,
    suggest_product,
)
from polar.merchant_migration.schemas import ProductMappingIncompatibility
from polar.models import Organization, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product, create_product_price_fixed


def _price(
    *,
    amount: int = 2000,
    currency: str = "usd",
) -> CanonicalPrice:
    return CanonicalPrice(
        source_id="price_1",
        currency=currency,
        amount=amount,
        pricing_scheme=CanonicalPricingScheme.fixed,
    )


def _canonical(
    *,
    name: str = "Pro",
    prices: list[CanonicalPrice] | None = None,
    recurring_interval: str | None = "month",
    recurring_interval_count: int = 1,
) -> CanonicalProduct:
    return CanonicalProduct(
        source_id="prod_1:month:1",
        product_source_id="prod_1",
        name=name,
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
        prices=prices or [_price()],
    )


async def _polar_product(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    name: str = "Pro",
    amount: int = 2000,
    interval: SubscriptionRecurringInterval | None = (
        SubscriptionRecurringInterval.month
    ),
    interval_count: int = 1,
    is_archived: bool = False,
    extra_prices: list[tuple[int, str]] | None = None,
) -> Product:
    prices: list[tuple[int, str]] = [(amount, "usd")]
    if extra_prices:
        prices.extend(extra_prices)
    return await create_product(
        save_fixture,
        organization=organization,
        name=name,
        recurring_interval=interval,
        recurring_interval_count=interval_count,
        is_archived=is_archived,
        prices=prices,
    )


@pytest.mark.asyncio
class TestIncompatibilities:
    async def test_compatible(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization)
        assert incompatibilities(_canonical(), polar) == []

    async def test_archived(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, is_archived=True)
        assert incompatibilities(_canonical(), polar) == [
            ProductMappingIncompatibility.not_recurring
        ]

    async def test_one_time_product(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, interval=None)
        assert incompatibilities(_canonical(), polar) == [
            ProductMappingIncompatibility.not_recurring
        ]

    async def test_interval_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture,
            organization,
            interval=SubscriptionRecurringInterval.year,
        )
        assert ProductMappingIncompatibility.interval_mismatch in incompatibilities(
            _canonical(), polar
        )

    async def test_interval_count_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, interval_count=3)
        assert ProductMappingIncompatibility.interval_mismatch in incompatibilities(
            _canonical(), polar
        )

    async def test_amount_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, amount=5000)
        canonical = _canonical()
        assert incompatibilities(canonical, polar) == [
            ProductMappingIncompatibility.amount_mismatch
        ]
        assert is_compatible(canonical, polar)

    async def test_currency_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization)
        reasons = incompatibilities(_canonical(prices=[_price(currency="eur")]), polar)
        assert ProductMappingIncompatibility.currency_mismatch in reasons

    async def test_extra_polar_currency_is_ok(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture, organization, extra_prices=[(1800, "eur")]
        )
        assert is_compatible(_canonical(), polar)


@pytest.mark.asyncio
class TestSuggestProduct:
    async def test_unique_name_and_price(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, name="Pro")
        assert suggest_product(_canonical(name="Pro"), [polar]) is polar

    async def test_unique_name_despite_amount_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture, organization, name="Pro", amount=5000
        )
        assert suggest_product(_canonical(name="Pro"), [polar]) is polar

    async def test_unique_compatible_different_name(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, name="Polar Pro")
        assert suggest_product(_canonical(name="Stripe Pro"), [polar]) is polar

    async def test_ambiguous_compatible_set(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        first = await create_product(
            save_fixture,
            organization=organization,
            name="Alpha",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(2000, "usd")],
        )
        second = await create_product(
            save_fixture,
            organization=organization,
            name="Beta",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(2000, "usd")],
        )
        assert suggest_product(_canonical(name="Pro"), [first, second]) is None

    async def test_does_not_suggest_different_name_and_amount(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture, organization, name="Starter", amount=5000
        )
        assert suggest_product(_canonical(name="Pro"), [polar]) is None

    async def test_prefers_name_among_compatible(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        other = await create_product(
            save_fixture,
            organization=organization,
            name="Other",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(2000, "usd")],
        )
        named = await create_product(
            save_fixture,
            organization=organization,
            name="Pro",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(2000, "usd")],
        )
        assert suggest_product(_canonical(name="Pro"), [other, named]) is named


@pytest.mark.asyncio
class TestDecideMapping:
    async def test_explicit_map(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization)
        decision = decide_mapping(_canonical(), [polar], polar.id)
        assert decision.product is polar
        assert decision.skip is None

    async def test_explicit_create_new(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization)
        decision = decide_mapping(_canonical(), [polar], None)
        assert decision.product is None
        assert decision.create_new is True
        assert decision.skip is None

    async def test_explicit_map_amount_mismatch(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, amount=5000)
        decision = decide_mapping(_canonical(), [polar], polar.id)
        assert decision.product is polar
        assert decision.skip is None

    async def test_incompatible_explicit_map(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture,
            organization,
            interval=SubscriptionRecurringInterval.year,
        )
        decision = decide_mapping(_canonical(), [polar], polar.id)
        assert decision.product is None
        assert decision.skip is not None
        assert decision.skip.code == "product_mapping_incompatible"

    async def test_missing_explicit_map(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization)
        decision = decide_mapping(_canonical(), [polar], uuid4())
        assert decision.product is None
        assert decision.skip is not None
        assert decision.skip.code == "product_mapping_not_found"

    async def test_auto_suggest(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, name="Pro")
        decision = decide_mapping(_canonical(name="Pro"), [polar], UNSET)
        assert decision.product is polar
        assert decision.skip is None

    async def test_name_collision_interval_mismatch_requires_choice(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture,
            organization,
            name="Pro",
            interval=SubscriptionRecurringInterval.year,
        )
        decision = decide_mapping(_canonical(name="Pro"), [polar], UNSET)
        assert decision.product is None
        assert decision.skip is not None
        assert decision.skip.code == "product_mapping_required"

    async def test_name_collision_amount_mismatch_maps(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture, organization, name="Pro", amount=5000
        )
        decision = decide_mapping(_canonical(name="Pro"), [polar], UNSET)
        assert decision.product is polar
        assert decision.skip is None

    async def test_no_collision_creates_new(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(
            save_fixture, organization, name="Starter", amount=5000
        )
        decision = decide_mapping(_canonical(name="Pro"), [polar], UNSET)
        assert decision.product is None
        assert decision.create_new is True
        assert decision.skip is None


class TestHelpers:
    def test_read_and_serialize_mappings(self) -> None:
        mapped_id = uuid4()
        stored = serialize_product_mappings({"a": mapped_id, "b": None})
        migration = SimpleNamespace(source_credentials={"product_mappings": stored})
        parsed = read_product_mappings(migration)  # type: ignore[arg-type]
        assert parsed["a"] == mapped_id
        assert parsed["b"] is None

    def test_subscriber_counts(self) -> None:
        product = _canonical()
        counts = subscriber_counts(
            [product],
            [
                CanonicalSubscription(
                    source_id="sub_1",
                    customer_source_id="cus_1",
                    price_source_id="price_1",
                    status=CanonicalSubscriptionStatus.active,
                    collection_method=CanonicalCollectionMethod.charge_automatically,
                    current_period_start=None,
                    current_period_end=None,
                    trialing=False,
                    paused_collection=False,
                    line_item_count=1,
                    quantity=1,
                    payment_method=None,
                    currency="usd",
                )
            ],
        )
        assert counts[product.source_id] == 1


def _subscription() -> CanonicalSubscription:
    return CanonicalSubscription(
        source_id="sub_1",
        customer_source_id="cus_1",
        price_source_id="price_1",
        status=CanonicalSubscriptionStatus.active,
        collection_method=CanonicalCollectionMethod.charge_automatically,
        current_period_start=None,
        current_period_end=None,
        trialing=False,
        paused_collection=False,
        line_item_count=1,
        quantity=1,
        payment_method=None,
        currency="usd",
    )


@pytest.mark.asyncio
class TestFindImportedPrice:
    async def test_finds_archived_grandfathered_amount(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, amount=1000)
        archived = await create_product_price_fixed(
            save_fixture, product=polar, amount=500, is_archived=True
        )
        found = find_imported_price(
            polar, _canonical(prices=[_price(amount=500)]), _subscription()
        )
        assert found is not None
        assert found.id == archived.id
        assert found.is_archived is True

    async def test_prefers_active_catalog_when_amounts_match(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        polar = await _polar_product(save_fixture, organization, amount=2000)
        found = find_imported_price(polar, _canonical(), _subscription())
        assert found is not None
        assert found.price_amount == 2000
        assert found.is_archived is False
