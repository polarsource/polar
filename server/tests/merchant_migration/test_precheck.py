from collections.abc import AsyncIterator
from dataclasses import replace

import pytest

from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.precheck import (
    classify_records,
    plan_customer_imports,
    plan_product_imports,
    precheck_engine,
    summarize_records,
)
from polar.merchant_migration.schemas import (
    PrecheckEntity,
    PrecheckIssueLevel,
    PrecheckReasonLevel,
    PrecheckRecordStatus,
    PrecheckReport,
)
from polar.models import Organization
from polar.models.organization import OrganizationStatus


async def aiter_records(
    records: list[CanonicalRecord],
) -> AsyncIterator[CanonicalRecord]:
    for record in records:
        yield record


def build_organization(
    status: OrganizationStatus = OrganizationStatus.ACTIVE,
    *,
    default_presentment_currency: str = "usd",
) -> Organization:
    return Organization(
        status=status, default_presentment_currency=default_presentment_currency
    )


def build_account(
    *, country: str | None = "US", has_connected_accounts: bool = False
) -> CanonicalAccount:
    return CanonicalAccount(
        country=country, has_connected_accounts=has_connected_accounts
    )


def build_customer(
    *,
    source_id: str = "cus_1",
    email: str = "a@example.com",
    country: str | None = "US",
) -> CanonicalCustomer:
    return CanonicalCustomer(
        source_id=source_id,
        email=email,
        name="A",
        country=country,
    )


def build_price(
    *,
    source_id: str = "price_1",
    currency: str = "usd",
    amount: int | None = 1000,
    pricing_scheme: CanonicalPricingScheme = CanonicalPricingScheme.fixed,
) -> CanonicalPrice:
    return CanonicalPrice(
        source_id=source_id,
        currency=currency,
        amount=amount,
        pricing_scheme=pricing_scheme,
    )


def build_product(
    *,
    source_id: str | None = None,
    product_source_id: str = "prod_1",
    name: str = "Pro",
    recurring_interval: str | None = "month",
    recurring_interval_count: int = 1,
    prices: list[CanonicalPrice] | None = None,
) -> CanonicalProduct:
    # A canonical product is keyed per (product, interval); default to a source_id
    # unique to that pair so distinct products don't collide.
    if source_id is None:
        source_id = (
            f"{product_source_id}:{recurring_interval}:{recurring_interval_count}"
        )
    return CanonicalProduct(
        source_id=source_id,
        product_source_id=product_source_id,
        name=name,
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
        prices=prices if prices is not None else [build_price()],
    )


def build_subscription(
    *,
    source_id: str = "sub_1",
    status: CanonicalSubscriptionStatus = CanonicalSubscriptionStatus.active,
    collection_method: CanonicalCollectionMethod = (
        CanonicalCollectionMethod.charge_automatically
    ),
    trialing: bool = False,
    paused_collection: bool = False,
    line_item_count: int = 1,
    quantity: int = 1,
    payment_method: CanonicalPaymentMethod | None = None,
    has_discount: bool = False,
    currency: str | None = "usd",
) -> CanonicalSubscription:
    return CanonicalSubscription(
        source_id=source_id,
        customer_source_id="cus_1",
        price_source_id="price_1",
        status=status,
        collection_method=collection_method,
        current_period_start=None,
        current_period_end=None,
        trialing=trialing,
        paused_collection=paused_collection,
        line_item_count=line_item_count,
        quantity=quantity,
        payment_method=payment_method,
        has_discount=has_discount,
        currency=currency,
    )


def codes(report: PrecheckReport, level: PrecheckIssueLevel) -> set[str]:
    return {issue.code for issue in report.issues if issue.level == level}


async def run(
    records: list[CanonicalRecord],
    *,
    organization: Organization | None = None,
    account: CanonicalAccount | None = None,
    existing_product_names: set[str] | None = None,
) -> PrecheckReport:
    return await precheck_engine.run(
        aiter_records(records),
        organization or build_organization(),
        account or build_account(),
        existing_product_names,
    )


@pytest.mark.asyncio
class TestPrecheckEngine:
    async def test_clean_catalog_can_start(self) -> None:
        report = await run([build_product(), build_customer(), build_subscription()])
        assert report.can_start is True
        assert report.issues == []

    async def test_consumes_stream_without_losing_record_types(self) -> None:
        # Regression: a one-shot stream must not be exhausted before customers.
        report = await run(
            [
                build_product(
                    prices=[build_price(pricing_scheme=CanonicalPricingScheme.tiered)]
                ),
                build_customer(source_id="cus_1", email="dup@example.com"),
                build_customer(source_id="cus_2", email="dup@example.com"),
            ]
        )
        warnings = codes(report, PrecheckIssueLevel.warning)
        assert "unsupported_pricing_scheme" in warnings
        assert "duplicate_customer_email" in warnings

    async def test_organization_not_renewal_enabled_blocks(self) -> None:
        report = await run(
            [build_product()],
            organization=build_organization(OrganizationStatus.CREATED),
        )
        assert "organization_not_renewal_enabled" in codes(
            report, PrecheckIssueLevel.blocker
        )

    async def test_india_account_blocks(self) -> None:
        report = await run([build_product()], account=build_account(country="IN"))
        assert "india_account" in codes(report, PrecheckIssueLevel.blocker)

    async def test_connected_accounts_block(self) -> None:
        report = await run(
            [build_product()], account=build_account(has_connected_accounts=True)
        )
        assert "source_has_connected_accounts" in codes(
            report, PrecheckIssueLevel.blocker
        )

    async def test_non_fixed_pricing_warns_and_can_start(self) -> None:
        report = await run(
            [
                build_product(
                    prices=[build_price(pricing_scheme=CanonicalPricingScheme.tiered)]
                )
            ]
        )
        assert "unsupported_pricing_scheme" in codes(report, PrecheckIssueLevel.warning)
        assert report.can_start is True

    async def test_one_time_product_warns(self) -> None:
        report = await run([build_product(recurring_interval=None)])
        assert "one_time_product" in codes(report, PrecheckIssueLevel.warning)

    async def test_short_product_name_warns(self) -> None:
        report = await run([build_product(name="AB")])
        assert "product_name_too_short" in codes(report, PrecheckIssueLevel.warning)

    async def test_short_name_does_not_double_report_with_one_time(self) -> None:
        # A one-time product is already dropped for a more fundamental reason;
        # the name check must not add a redundant warning.
        report = await run([build_product(name="X", recurring_interval=None)])
        warnings = codes(report, PrecheckIssueLevel.warning)
        assert "one_time_product" in warnings
        assert "product_name_too_short" not in warnings

    async def test_unsupported_interval_count_warns(self) -> None:
        report = await run([build_product(recurring_interval_count=1000)])
        assert "unsupported_recurring_interval" in codes(
            report, PrecheckIssueLevel.warning
        )

    async def test_unsupported_currency_warns(self) -> None:
        report = await run([build_product(prices=[build_price(currency="xyz")])])
        assert "unsupported_currency" in codes(report, PrecheckIssueLevel.warning)

    async def test_product_without_default_currency_price_warns(self) -> None:
        report = await run(
            [
                build_product(product_source_id="prod_1", name="Pro"),
                build_product(
                    product_source_id="prod_2",
                    name="Team",
                    prices=[build_price(source_id="price_eur", currency="eur")],
                ),
            ]
        )
        assert "missing_default_currency_price" in codes(
            report, PrecheckIssueLevel.warning
        )
        # One product still imports, so the catalog is worth importing.
        assert report.can_start is True

    async def test_catalog_priced_in_another_currency_blocks(self) -> None:
        report = await run(
            [build_product(prices=[build_price(currency="eur")])],
        )
        assert "no_default_currency_prices" in codes(report, PrecheckIssueLevel.blocker)
        assert report.can_start is False

    async def test_blocker_names_only_the_currencies_polar_would_take(self) -> None:
        # A price Polar drops anyway isn't a currency the merchant can switch to.
        report = await run(
            [
                build_product(
                    prices=[
                        build_price(source_id="price_eur", currency="eur"),
                        build_price(source_id="price_bad", currency="xyz"),
                    ]
                )
            ]
        )
        blocker = next(
            issue
            for issue in report.issues
            if issue.code == "no_default_currency_prices"
        )
        assert "EUR" in blocker.message
        assert "XYZ" not in blocker.message

    async def test_blocker_does_not_claim_dropped_products_lack_the_currency(
        self,
    ) -> None:
        # The one-time product does have a USD price; it just can't be imported.
        report = await run(
            [
                build_product(
                    product_source_id="prod_1", name="Legacy", recurring_interval=None
                ),
                build_product(
                    product_source_id="prod_2",
                    name="Pro",
                    prices=[build_price(source_id="price_eur", currency="eur")],
                ),
            ]
        )
        blocker = next(
            issue
            for issue in report.issues
            if issue.code == "no_default_currency_prices"
        )
        assert "No product can be imported." in blocker.message
        assert "EUR" in blocker.message

    async def test_default_currency_matching_the_catalog_does_not_warn(self) -> None:
        report = await run(
            [build_product(prices=[build_price(currency="eur")])],
            organization=build_organization(default_presentment_currency="eur"),
        )
        assert report.issues == []
        assert report.can_start is True

    async def test_product_with_a_price_in_each_currency_does_not_warn(self) -> None:
        report = await run(
            [
                build_product(
                    prices=[
                        build_price(source_id="price_usd", currency="usd"),
                        build_price(source_id="price_eur", currency="eur"),
                    ]
                )
            ]
        )
        assert report.issues == []

    async def test_product_without_importable_price_keeps_its_own_reason(self) -> None:
        report = await run(
            [build_product(prices=[build_price(currency="eur", amount=None)])]
        )
        warnings = codes(report, PrecheckIssueLevel.warning)
        assert "unsupported_price_amount" in warnings
        assert "missing_default_currency_price" not in warnings

    async def test_price_below_minimum_warns(self) -> None:
        report = await run([build_product(prices=[build_price(amount=1)])])
        assert "price_out_of_bounds" in codes(report, PrecheckIssueLevel.warning)

    async def test_free_price_is_allowed(self) -> None:
        report = await run([build_product(prices=[build_price(amount=0)])])
        assert "price_out_of_bounds" not in codes(report, PrecheckIssueLevel.warning)

    async def test_price_without_amount_warns(self) -> None:
        report = await run([build_product(prices=[build_price(amount=None)])])
        assert "unsupported_price_amount" in codes(report, PrecheckIssueLevel.warning)

    async def test_duplicate_product_names_warn(self) -> None:
        report = await run(
            [
                build_product(source_id="prod_1:month:1", product_source_id="prod_1"),
                build_product(source_id="prod_2:month:1", product_source_id="prod_2"),
            ]
        )
        assert "duplicate_product_name" in codes(report, PrecheckIssueLevel.warning)
        assert report.can_start is True

    async def test_existing_polar_product_warns_without_blocking(self) -> None:
        report = await run(
            [build_product(name="Pro")],
            existing_product_names={"pro"},
        )
        assert "product_exists_in_polar" in codes(report, PrecheckIssueLevel.warning)
        assert report.can_start is True
        # the collision is a warning only: the product still imports.
        products = next(
            e for e in report.entities if e.entity == PrecheckEntity.products
        )
        assert products.importable == 1

    async def test_no_existing_products_no_warning(self) -> None:
        report = await run([build_product(name="Pro")])
        assert "product_exists_in_polar" not in codes(
            report, PrecheckIssueLevel.warning
        )

    async def test_same_product_different_intervals_is_not_a_duplicate(self) -> None:
        report = await run(
            [
                build_product(
                    source_id="prod_1:month:1",
                    product_source_id="prod_1",
                    recurring_interval="month",
                ),
                build_product(
                    source_id="prod_1:year:1",
                    product_source_id="prod_1",
                    recurring_interval="year",
                ),
            ]
        )
        assert "duplicate_product_name" not in codes(report, PrecheckIssueLevel.warning)

    async def test_duplicate_emails_warn(self) -> None:
        report = await run(
            [
                build_customer(source_id="cus_1", email="a@example.com"),
                build_customer(source_id="cus_2", email="A@Example.com"),
            ]
        )
        assert "duplicate_customer_email" in codes(report, PrecheckIssueLevel.warning)

    async def test_missing_country_warns(self) -> None:
        report = await run(
            [
                build_customer(source_id="cus_1", country=None),
                build_customer(source_id="cus_2", country="US"),
            ]
        )
        assert "customer_missing_country" in codes(report, PrecheckIssueLevel.warning)

    async def test_missing_email_warns(self) -> None:
        report = await run(
            [
                build_customer(source_id="cus_1", email=""),
                build_customer(source_id="cus_2", email="a@example.com"),
            ]
        )
        assert "customer_missing_email" in codes(report, PrecheckIssueLevel.warning)

    async def test_subscription_warnings_do_not_block(self) -> None:
        report = await run(
            [
                build_subscription(source_id="sub_multi", line_item_count=2),
                build_subscription(source_id="sub_qty", quantity=5),
                build_subscription(
                    source_id="sub_invoice",
                    collection_method=CanonicalCollectionMethod.send_invoice,
                ),
                build_subscription(
                    source_id="sub_past_due",
                    status=CanonicalSubscriptionStatus.past_due,
                ),
                build_subscription(source_id="sub_paused", paused_collection=True),
                build_subscription(source_id="sub_trial", trialing=True),
                build_subscription(
                    source_id="sub_link",
                    payment_method=CanonicalPaymentMethod(
                        source_id="pm_1", type=CanonicalPaymentMethodType.link
                    ),
                ),
            ]
        )
        warnings = codes(report, PrecheckIssueLevel.warning)
        assert "multiple_line_items" in warnings
        assert "unsupported_quantity" in warnings
        assert "send_invoice_collection" in warnings
        assert "subscription_not_importable" in warnings
        assert "subscription_paused_collection" in warnings
        assert "subscription_trialing" in warnings
        assert "payment_method_requires_reentry" in warnings
        assert report.can_start is True

    async def test_copyable_payment_method_does_not_warn(self) -> None:
        report = await run(
            [
                build_subscription(
                    payment_method=CanonicalPaymentMethod(
                        source_id="pm_1", type=CanonicalPaymentMethodType.card
                    )
                )
            ]
        )
        assert "payment_method_requires_reentry" not in codes(
            report, PrecheckIssueLevel.warning
        )


class TestClassifyRecords:
    def test_products_importable_and_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="Pro"),
            build_product(
                product_source_id="prod_2", name="Legacy", recurring_interval=None
            ),
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        by_id = {item.source_id: item for item in items}
        assert by_id["prod_1"].status == PrecheckRecordStatus.importable
        assert by_id["prod_2"].status == PrecheckRecordStatus.skipped
        assert by_id["prod_2"].reason_code == "one_time_product"

    def test_product_without_importable_price_skipped(self) -> None:
        # The classifier must agree with the importer: a product whose only price
        # can't be imported is skipped, not promised as importable.
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[
                    build_price(pricing_scheme=CanonicalPricingScheme.tiered),
                ],
            ),
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "no_importable_price"

    def test_subscription_with_discount_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1", has_discount=True),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_has_discount"

    def test_prices_drop_unsupported_scheme(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[build_price(source_id="price_ok")],
            ),
            build_product(
                product_source_id="prod_2",
                name="Metered",
                prices=[
                    build_price(
                        source_id="price_metered",
                        pricing_scheme=CanonicalPricingScheme.metered,
                    )
                ],
            ),
        ]

        items = classify_records(records, PrecheckEntity.prices, "usd")

        by_id = {item.source_id: item for item in items}
        assert by_id["price_ok"].status == PrecheckRecordStatus.importable
        assert by_id["price_metered"].status == PrecheckRecordStatus.skipped
        assert by_id["price_metered"].reason_code == "unsupported_pricing_scheme"

    def test_missing_country_is_importable_and_action_required(self) -> None:
        records: list[CanonicalRecord] = [
            build_customer(source_id="cus_1", email="a@example.com", country=None)
        ]

        items = classify_records(records, PrecheckEntity.customers, "usd")

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].reason_code == "customer_missing_country"
        assert items[0].reason_level == PrecheckReasonLevel.action_required

    def test_trialing_subscription_is_importable_with_info(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1", trialing=True),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].reason_code == "subscription_trialing"
        assert items[0].reason_level == PrecheckReasonLevel.info

    def test_payment_method_reentry_is_importable_with_info(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(
                source_id="sub_1",
                payment_method=CanonicalPaymentMethod(
                    source_id="pm_1", type=CanonicalPaymentMethodType.link
                ),
            ),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].reason_code == "payment_method_requires_reentry"
        assert items[0].reason_level == PrecheckReasonLevel.info

    def test_skipped_record_carries_its_level(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1", has_discount=True),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_level == PrecheckReasonLevel.action_required

    def test_two_prices_in_one_currency_skip_the_product(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[
                    build_price(source_id="price_old", amount=1000),
                    build_price(source_id="price_new", amount=1200),
                ],
            )
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "multiple_prices_same_currency"
        assert items[0].reason_level == PrecheckReasonLevel.action_required

    def test_one_price_per_currency_imports(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[
                    build_price(source_id="price_usd", currency="usd"),
                    build_price(source_id="price_eur", currency="eur"),
                ],
            )
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.importable

    def test_a_dropped_price_does_not_count_as_a_collision(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[
                    build_price(source_id="price_ok", amount=1000),
                    build_price(
                        source_id="price_tiered",
                        amount=1200,
                        pricing_scheme=CanonicalPricingScheme.tiered,
                    ),
                ],
            )
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.importable

    def test_product_row_shows_a_price_that_will_import(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[
                    build_price(
                        source_id="price_tiered",
                        amount=99,
                        pricing_scheme=CanonicalPricingScheme.tiered,
                    ),
                    build_price(source_id="price_ok", amount=1000),
                ],
            )
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].amount == 1000

    def test_subscription_skipped_when_its_customer_was_not_extracted(self) -> None:
        subscription = replace(
            build_subscription(source_id="sub_1"), customer_source_id="cus_gone"
        )
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            subscription,
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_customer_not_importable"

    def test_product_without_default_currency_price_skipped(self) -> None:
        # Polar requires a price in the organization's default currency, so the
        # classifier must not promise a product the importer would reject.
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[build_price(source_id="price_eur", currency="eur")],
            )
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "missing_default_currency_price"
        assert items[0].reason_level == PrecheckReasonLevel.action_required

    def test_short_product_name_skipped(self) -> None:
        # The classifier must agree with the importer: a name Polar's schema
        # rejects is skipped, not promised as importable (which would crash).
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="AB"),
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "product_name_too_short"
        assert items[0].reason_level == PrecheckReasonLevel.action_required

    def test_subscription_of_product_without_default_currency_price_skipped(
        self,
    ) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                prices=[build_price(source_id="price_1", currency="eur")],
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1"),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_product_not_importable"

    def test_product_matching_an_existing_polar_name_gets_a_note(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="Pro")
        ]

        items = classify_records(records, PrecheckEntity.products, "usd", {"pro"})

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].reason_code == "product_exists_in_polar"
        assert items[0].reason_level == PrecheckReasonLevel.info

    def test_duplicate_customer_email_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_customer(source_id="cus_1", email="same@example.com"),
            build_customer(source_id="cus_2", email="same@example.com"),
        ]

        items = classify_records(records, PrecheckEntity.customers, "usd")

        by_id = {item.source_id: item for item in items}
        assert by_id["cus_1"].status == PrecheckRecordStatus.importable
        assert by_id["cus_2"].status == PrecheckRecordStatus.skipped
        assert by_id["cus_2"].reason_code == "duplicate_customer_email"
        assert by_id["cus_2"].reason_level == PrecheckReasonLevel.action_required

    def test_customer_without_email_skipped(self) -> None:
        # The classifier must agree with the importer: a customer with no email
        # is skipped, not promised as importable.
        records: list[CanonicalRecord] = [build_customer(source_id="cus_1", email="")]

        items = classify_records(records, PrecheckEntity.customers, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "customer_missing_email"

    def test_subscription_status_drop(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1"),
            build_subscription(
                source_id="sub_2", status=CanonicalSubscriptionStatus.past_due
            ),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        by_id = {item.source_id: item for item in items}
        assert by_id["sub_1"].status == PrecheckRecordStatus.importable
        assert by_id["sub_1"].title == "a@example.com"
        assert by_id["sub_2"].status == PrecheckRecordStatus.skipped
        assert by_id["sub_2"].reason_code == "subscription_not_importable"


class TestSummarizeRecords:
    def test_counts_match_classification(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="Pro"),
            build_product(
                product_source_id="prod_2", name="Legacy", recurring_interval=None
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
        ]

        summaries = {s.entity: s for s in summarize_records(records, "usd")}

        assert summaries[PrecheckEntity.products].total == 2
        assert summaries[PrecheckEntity.products].importable == 1
        assert summaries[PrecheckEntity.products].skipped == 1
        assert summaries[PrecheckEntity.customers].total == 1
        assert summaries[PrecheckEntity.subscriptions].total == 0

        for entity, summary in summaries.items():
            items = classify_records(records, entity, "usd")
            importable = sum(
                1 for i in items if i.status == PrecheckRecordStatus.importable
            )
            assert summary.total == len(items)
            assert summary.importable == importable
            assert summary.skipped == len(items) - importable


class TestClassifyCascade:
    def test_same_product_multiple_intervals_not_duplicate(self) -> None:
        # One source product split into two interval rows keeps its source id and
        # must not be flagged as a duplicate name.
        records: list[CanonicalRecord] = [
            build_product(
                source_id="prod_1:month:1",
                product_source_id="prod_1",
                name="Pro",
                recurring_interval="month",
            ),
            build_product(
                source_id="prod_1:year:1",
                product_source_id="prod_1",
                name="Pro",
                recurring_interval="year",
            ),
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        assert len(items) == 2
        assert all(i.status == PrecheckRecordStatus.importable for i in items)

    def test_distinct_products_same_name_both_import(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="Pro"),
            build_product(product_source_id="prod_2", name="Pro"),
        ]

        items = classify_records(records, PrecheckEntity.products, "usd")

        by_id = {item.source_id: item for item in items}
        for source_id in ("prod_1", "prod_2"):
            assert by_id[source_id].status == PrecheckRecordStatus.importable
            assert by_id[source_id].reason_code == "duplicate_product_name"
            assert by_id[source_id].reason_level == PrecheckReasonLevel.info

    def test_price_skipped_when_parent_product_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                name="Legacy",
                recurring_interval=None,
                prices=[build_price(source_id="price_1")],
            ),
        ]

        items = classify_records(records, PrecheckEntity.prices, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "one_time_product"

    def test_subscription_skipped_when_product_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                name="Legacy",
                recurring_interval=None,
                prices=[build_price(source_id="price_1")],
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            build_subscription(source_id="sub_1"),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_product_not_importable"

    def test_subscription_skipped_when_customer_skipped(self) -> None:
        duplicate_customer_subscription = replace(
            build_subscription(source_id="sub_2"), customer_source_id="cus_2"
        )
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="dup@example.com"),
            build_customer(source_id="cus_2", email="dup@example.com"),
            duplicate_customer_subscription,
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_customer_not_importable"

    def test_subscription_imports_when_its_product_shares_a_name(self) -> None:
        subscription = replace(
            build_subscription(source_id="sub_2"), price_source_id="price_2"
        )
        records: list[CanonicalRecord] = [
            build_product(
                source_id="prod_1:month:1",
                product_source_id="prod_1",
                name="Pro",
                prices=[build_price(source_id="price_1")],
            ),
            build_product(
                source_id="prod_2:month:1",
                product_source_id="prod_2",
                name="Pro",
                prices=[build_price(source_id="price_2")],
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            subscription,
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.importable

    def test_subscription_skipped_when_price_not_extracted(self) -> None:
        # The subscription runs on a price the source no longer lists (archived),
        # so no product carrying that price id was extracted.
        subscription = replace(
            build_subscription(source_id="sub_1"),
            price_source_id="price_archived",
        )
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1", prices=[build_price(source_id="price_1")]
            ),
            build_customer(source_id="cus_1", email="a@example.com"),
            subscription,
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_product_not_importable"

    def test_subscription_uses_currency_option_on_shared_price_id(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                prices=[
                    build_price(source_id="price_1", currency="eur", amount=900),
                    build_price(source_id="price_1", currency="usd", amount=1000),
                ]
            ),
            build_customer(),
            build_subscription(currency="usd"),
        ]

        items = classify_records(records, PrecheckEntity.subscriptions, "usd")

        assert items[0].status == PrecheckRecordStatus.importable
        assert items[0].currency == "usd"
        assert items[0].amount == 1000


class TestPlanProductImports:
    def test_importable_product_lists_its_prices(self) -> None:
        product = build_product(prices=[build_price(source_id="price_1")])

        plans = plan_product_imports([product], "usd")

        plan = plans[product.source_id]
        assert plan.importable is True
        assert plan.importable_prices == {("price_1", "usd")}

    def test_one_time_product_is_skipped(self) -> None:
        product = build_product(source_id="prod_1:one_time", recurring_interval=None)

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is False
        assert plan.skip is not None
        assert plan.skip.code == "one_time_product"

    def test_drops_unsupported_prices_but_keeps_the_rest(self) -> None:
        product = build_product(
            prices=[
                build_price(source_id="price_ok"),
                build_price(
                    source_id="price_bad",
                    pricing_scheme=CanonicalPricingScheme.tiered,
                ),
            ]
        )

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is True
        assert plan.importable_prices == {("price_ok", "usd")}

    def test_product_with_no_importable_price_is_skipped(self) -> None:
        product = build_product(
            prices=[
                build_price(
                    source_id="price_bad",
                    pricing_scheme=CanonicalPricingScheme.metered,
                )
            ]
        )

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is False
        assert plan.skip is not None
        assert plan.skip.code == "no_importable_price"

    def test_product_without_default_currency_price_is_skipped(self) -> None:
        product = build_product(
            prices=[build_price(source_id="price_eur", currency="eur")]
        )

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is False
        assert plan.skip is not None
        assert plan.skip.code == "missing_default_currency_price"

    def test_short_product_name_is_skipped(self) -> None:
        product = build_product(name="AB")

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is False
        assert plan.skip is not None
        assert plan.skip.code == "product_name_too_short"
        assert plan.importable_prices == set()

    def test_default_currency_price_keeps_the_other_currencies(self) -> None:
        product = build_product(
            prices=[
                build_price(source_id="price_usd", currency="usd"),
                build_price(source_id="price_eur", currency="eur"),
            ]
        )

        plan = plan_product_imports([product], "usd")[product.source_id]

        assert plan.importable is True
        assert plan.importable_prices == {
            ("price_usd", "usd"),
            ("price_eur", "eur"),
        }

    def test_products_sharing_a_name_both_import(self) -> None:
        first = build_product(source_id="prod_1:month:1", product_source_id="prod_1")
        second = build_product(source_id="prod_2:month:1", product_source_id="prod_2")

        plans = plan_product_imports([first, second], "usd")

        assert plans[first.source_id].importable is True
        assert plans[second.source_id].importable is True


class TestPlanCustomerImports:
    def test_unique_customers_are_importable(self) -> None:
        customer = build_customer(source_id="cus_1", email="a@example.com")

        assert plan_customer_imports([customer])[customer.source_id] is None

    def test_duplicate_email_skips_the_later_customer(self) -> None:
        first = build_customer(source_id="cus_1", email="a@example.com")
        second = build_customer(source_id="cus_2", email="a@example.com")

        plans = plan_customer_imports([first, second])
        skip = plans["cus_2"]

        assert plans["cus_1"] is None
        assert skip is not None
        assert skip.code == "duplicate_customer_email"

    def test_customer_without_email_is_skipped(self) -> None:
        customer = build_customer(source_id="cus_1", email="")

        skip = plan_customer_imports([customer])["cus_1"]

        assert skip is not None
        assert skip.code == "customer_missing_email"
