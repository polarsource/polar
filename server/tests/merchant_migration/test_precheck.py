from collections.abc import AsyncIterator

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
from polar.merchant_migration.precheck import precheck_engine
from polar.merchant_migration.schemas import PrecheckIssueLevel, PrecheckReport
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
