from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.enums import (
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
    TaxBehavior,
    TaxBehaviorOption,
    TaxProcessor,
)
from polar.kit.address import Address
from polar.models import (
    BillingEntry,
    Customer,
    OrderItem,
    Organization,
    Product,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription_meter import SubscriptionMeter
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from polar.tax.calculation import get_tax_behavior_from_option
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_billing_entry,
    create_customer,
    create_discount,
    create_meter,
    create_product,
    create_wallet_billing,
)


@pytest.fixture
def tax_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.order.amounts.tax_calculation_service")


def set_tax(tax_mock: MagicMock, amount: int) -> None:
    async def calculate(
        reference: str,
        currency: str,
        taxable_amount: int,
        tax_behavior_option: TaxBehaviorOption,
        tax_code: Any,
        address: Address,
        tax_ids: list[Any],
        tax_exempted: bool,
    ) -> tuple[dict[str, Any], TaxProcessor]:
        return (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": amount,
                "currency": currency,
                "tax_behavior": get_tax_behavior_from_option(
                    tax_behavior_option, address
                ),
                "tax_breakdown": [],
            },
            TaxProcessor.stripe,
        )

    tax_mock.calculate = AsyncMock(side_effect=calculate)


@pytest.mark.asyncio
class TestCalculateChargePreview:
    async def test_fixed_price_only(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 1000
        assert preview.metered_amount == 0
        assert preview.proration_amount == 0
        assert preview.prorations == []
        assert preview.subtotal_amount == 1000
        assert preview.discount_amount == 0
        assert preview.net_amount == 1000
        assert preview.tax_amount == 0
        assert preview.total_amount == 1000

    async def test_wallet_credit_reduces_due_amount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_wallet_billing(
            save_fixture, customer=customer, initial_balance=300
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.total_amount == 1000
        assert preview.applied_balance_amount == -300
        assert preview.due_amount == 700
        assert preview.due_amount == max(
            0, preview.total_amount + preview.applied_balance_amount
        )
        assert preview.due_amount != preview.total_amount

    async def test_cancel_at_period_end_zeroes_base(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, cancel_at_period_end=True
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 0
        assert preview.subtotal_amount == 0
        assert preview.total_amount == 0

    async def test_percentage_discount_applies_to_recurring(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2500,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 1000
        assert preview.discount_amount == 250
        assert preview.net_amount == 750
        assert preview.total_amount == 750

    async def test_exclusive_tax_added_on_top(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        tax_mock: MagicMock,
    ) -> None:
        set_tax(tax_mock, 200)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country="FR"),  # type: ignore[arg-type]
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            tax_behavior=TaxBehavior.exclusive,
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.net_amount == 1000
        assert preview.tax_amount == 200
        assert preview.total_amount == 1200

    async def test_inclusive_tax_carved_out_of_net(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        tax_mock: MagicMock,
    ) -> None:
        set_tax(tax_mock, 200)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country="FR"),  # type: ignore[arg-type]
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            tax_behavior=TaxBehavior.inclusive,
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.net_amount == 800
        assert preview.tax_amount == 200
        assert preview.total_amount == 1000

    async def test_metered_amount_included_in_subtotal(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        meter = await create_meter(save_fixture, organization=organization)
        await save_fixture(
            SubscriptionMeter(subscription=subscription, meter=meter, amount=500)
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 1000
        assert preview.metered_amount == 500
        assert preview.subtotal_amount == 1500
        assert preview.total_amount == 1500

    async def test_prorations_surfaced_and_excluded_from_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2500,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )
        price = subscription.product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.debit,
            customer=customer,
            product_price=price,
            subscription=subscription,
            amount=3375,
            discount_amount=1125,
            currency="usd",
            start_timestamp=datetime(2025, 9, 16, tzinfo=UTC),
            end_timestamp=datetime(2025, 10, 1, tzinfo=UTC),
        )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.credit,
            customer=customer,
            product_price=price,
            subscription=subscription,
            amount=1125,
            discount_amount=375,
            currency="usd",
            start_timestamp=datetime(2025, 9, 16, tzinfo=UTC),
            end_timestamp=datetime(2025, 10, 1, tzinfo=UTC),
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 1000
        assert preview.proration_amount == 3375 - 1125
        assert len(preview.prorations) == 2
        assert preview.subtotal_amount == 1000 + 2250
        # 25% of the recurring amount (1000) only — NOT of the 2250 proration.
        assert preview.discount_amount == 250
        assert preview.net_amount == 3250 - 250
        assert preview.total_amount == 3000


@pytest.mark.asyncio
class TestCalculateChargePreviewTaxMatchesOrder:
    """Any non-zero amount is taxed — negated for a credit — and an unset tax
    behavior falls back to the organization's default, as `order.amounts` does.
    """

    async def test_negative_net_is_taxed_as_a_credit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        tax_mock: MagicMock,
    ) -> None:
        set_tax(tax_mock, 200)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country="FR"),  # type: ignore[arg-type]
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, cancel_at_period_end=True
        )
        price = subscription.product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.credit,
            customer=customer,
            product_price=price,
            subscription=subscription,
            amount=1125,
            currency="usd",
            start_timestamp=datetime(2025, 9, 16, tzinfo=UTC),
            end_timestamp=datetime(2025, 10, 1, tzinfo=UTC),
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        assert preview.base_amount == 0
        assert preview.proration_amount == -1125
        assert preview.subtotal_amount == -1125
        assert preview.net_amount == -1125
        # We owe the customer the tax on the credit too, as the invoice records it.
        assert preview.tax_amount == -200
        assert preview.total_amount == -1325
        tax_mock.calculate.assert_called_once()

    async def test_unset_tax_behavior_falls_back_to_organization_default(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        tax_mock: MagicMock,
    ) -> None:
        set_tax(tax_mock, 200)
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country="FR"),  # type: ignore[arg-type]
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, tax_behavior=None
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        # `location` default + a non-tax-exclusive country resolves to inclusive,
        # so the tax is carved out of the total rather than added on top.
        assert preview.net_amount == 800
        assert preview.tax_amount == 200
        assert preview.total_amount == 1000
        tax_mock.calculate.assert_called_once()


@pytest.mark.asyncio
class TestCalculateChargePreviewPersistsNothing:
    async def test_pending_update_is_previewed_but_not_persisted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """The pending update is applied in memory to price the next charge.

        None of it may reach the database, and the surrounding transaction survives.
        """
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(5000, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_id = subscription.id

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=new_product.id,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )
        await session.flush()

        entries_before = await session.scalar(
            select(func.count()).select_from(BillingEntry)
        )

        preview = await subscription_service.calculate_charge_preview(
            session, subscription
        )

        # The pending update is reflected in the preview...
        assert preview.base_amount == 5000

        # ...but a later flush (as at request end) must not persist it.
        await session.flush()

        assert (
            await session.scalar(
                select(Subscription.product_id).where(
                    Subscription.id == subscription_id
                )
            )
            == product.id
        )
        assert (
            await session.scalar(select(func.count()).select_from(BillingEntry))
            == entries_before
        )
        # The preview builds `OrderItem`s to price the charge; none may be persisted.
        assert await session.scalar(select(func.count()).select_from(OrderItem)) == 0

    async def test_surrounding_transaction_survives(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """The preview leaves the caller's own uncommitted work intact."""
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_id = subscription.id

        await subscription_service.calculate_charge_preview(session, subscription)

        assert (
            await session.scalar(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.id == subscription_id)
            )
            == 1
        )
