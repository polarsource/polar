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
    precheck_engine,
    summarize_records,
)
from polar.merchant_migration.schemas import (
    PrecheckEntity,
    PrecheckIssueLevel,
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
) -> Organization:
    return Organization(status=status)


def build_account(
    *, country: str | None = "US", is_connect_platform: bool = False
) -> CanonicalAccount:
    return CanonicalAccount(country=country, is_connect_platform=is_connect_platform)


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
    source_id: str = "prod_1:month:1",
    product_source_id: str = "prod_1",
    name: str = "Pro",
    recurring_interval: str | None = "month",
    recurring_interval_count: int = 1,
    prices: list[CanonicalPrice] | None = None,
) -> CanonicalProduct:
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
    )


def codes(report: PrecheckReport, level: PrecheckIssueLevel) -> set[str]:
    return {issue.code for issue in report.issues if issue.level == level}


async def run(
    records: list[CanonicalRecord],
    *,
    organization: Organization | None = None,
    account: CanonicalAccount | None = None,
) -> PrecheckReport:
    return await precheck_engine.run(
        aiter_records(records),
        organization or build_organization(),
        account or build_account(),
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

    async def test_connect_platform_account_blocks(self) -> None:
        report = await run(
            [build_product()], account=build_account(is_connect_platform=True)
        )
        assert "connect_platform_account" in codes(report, PrecheckIssueLevel.blocker)

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

    async def test_unsupported_interval_count_warns(self) -> None:
        report = await run([build_product(recurring_interval_count=1000)])
        assert "unsupported_recurring_interval" in codes(
            report, PrecheckIssueLevel.warning
        )

    async def test_unsupported_currency_warns(self) -> None:
        report = await run([build_product(prices=[build_price(currency="xyz")])])
        assert "unsupported_currency" in codes(report, PrecheckIssueLevel.warning)

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

        items = classify_records(records, PrecheckEntity.products)

        by_id = {item.source_id: item for item in items}
        assert by_id["prod_1"].status == PrecheckRecordStatus.importable
        assert by_id["prod_2"].status == PrecheckRecordStatus.skipped
        assert by_id["prod_2"].reason_code == "one_time_product"

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

        items = classify_records(records, PrecheckEntity.prices)

        by_id = {item.source_id: item for item in items}
        assert by_id["price_ok"].status == PrecheckRecordStatus.importable
        assert by_id["price_metered"].status == PrecheckRecordStatus.skipped
        assert by_id["price_metered"].reason_code == "unsupported_pricing_scheme"

    def test_duplicate_customer_email_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_customer(source_id="cus_1", email="same@example.com"),
            build_customer(source_id="cus_2", email="same@example.com"),
        ]

        items = classify_records(records, PrecheckEntity.customers)

        by_id = {item.source_id: item for item in items}
        assert by_id["cus_1"].status == PrecheckRecordStatus.importable
        assert by_id["cus_2"].status == PrecheckRecordStatus.skipped
        assert by_id["cus_2"].reason_code == "duplicate_customer_email"

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

        items = classify_records(records, PrecheckEntity.subscriptions)

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

        summaries = {s.entity: s for s in summarize_records(records)}

        assert summaries[PrecheckEntity.products].total == 2
        assert summaries[PrecheckEntity.products].importable == 1
        assert summaries[PrecheckEntity.products].skipped == 1
        assert summaries[PrecheckEntity.customers].total == 1
        assert summaries[PrecheckEntity.subscriptions].total == 0

        for entity, summary in summaries.items():
            items = classify_records(records, entity)
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

        items = classify_records(records, PrecheckEntity.products)

        assert len(items) == 2
        assert all(i.status == PrecheckRecordStatus.importable for i in items)

    def test_distinct_products_same_name_duplicate(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(product_source_id="prod_1", name="Pro"),
            build_product(product_source_id="prod_2", name="Pro"),
        ]

        items = classify_records(records, PrecheckEntity.products)

        by_id = {item.source_id: item for item in items}
        assert by_id["prod_1"].status == PrecheckRecordStatus.importable
        assert by_id["prod_2"].status == PrecheckRecordStatus.skipped
        assert by_id["prod_2"].reason_code == "duplicate_product_name"

    def test_price_skipped_when_parent_product_skipped(self) -> None:
        records: list[CanonicalRecord] = [
            build_product(
                product_source_id="prod_1",
                name="Legacy",
                recurring_interval=None,
                prices=[build_price(source_id="price_1")],
            ),
        ]

        items = classify_records(records, PrecheckEntity.prices)

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

        items = classify_records(records, PrecheckEntity.subscriptions)

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

        items = classify_records(records, PrecheckEntity.subscriptions)

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_customer_not_importable"

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

        items = classify_records(records, PrecheckEntity.subscriptions)

        assert items[0].status == PrecheckRecordStatus.skipped
        assert items[0].reason_code == "subscription_product_not_importable"
