"""Fixtures and helpers for lifecycle E2E tests."""

import uuid
from collections.abc import Sequence

import pytest_asyncio
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product, User, UserOrganization
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrant
from polar.models.billing_entry import BillingEntry, BillingEntryType
from polar.models.product_price import ProductPriceSeatUnit
from polar.worker import JobQueueManager
from tests.e2e.infra import DrainFn, DrainResult
from tests.e2e.purchase.subscription.conftest import monthly_product  # noqa: F401
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_organization,
    create_product,
    set_product_benefits,
)


async def trigger_subscription_cycle(
    session: AsyncSession,
    drain: DrainFn,
    subscription_id: uuid.UUID,
) -> DrainResult:
    """
    Directly enqueue a subscription cycle — bypasses the scheduler picker.

    Use ``SchedulerSimulator.trigger_due_cycles()`` instead when you want to
    exercise the full scheduler query (with freezegun time control).

    This helper is kept for cases where you need to force-cycle a specific
    subscription regardless of its period dates.
    """
    await session.flush()
    jqm = JobQueueManager.set()
    jqm.enqueue_job("subscription.cycle", subscription_id)
    return await drain()


async def get_billing_entries(
    session: AsyncSession,
    subscription_id: uuid.UUID,
    entry_type: BillingEntryType,
) -> Sequence[BillingEntry]:
    result = await session.execute(
        select(BillingEntry)
        .where(
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.type == entry_type,
        )
        .order_by(BillingEntry.created_at)
    )
    return result.scalars().all()


async def get_benefit_grants(
    session: AsyncSession,
    customer_id: uuid.UUID,
    benefit_id: uuid.UUID,
) -> Sequence[BenefitGrant]:
    result = await session.execute(
        select(BenefitGrant).where(
            BenefitGrant.customer_id == customer_id,
            BenefitGrant.benefit_id == benefit_id,
        )
    )
    return result.scalars().all()


@pytest_asyncio.fixture
async def monthly_product_with_benefit(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="E2E Monthly Plan",
        prices=[(1500, "usd")],
        is_tax_applicable=False,
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.custom,
        description="Member-only content",
    )
    return await set_product_benefits(save_fixture, product=product, benefits=[benefit])


@pytest_asyncio.fixture
async def seat_org(save_fixture: SaveFixture, user: User) -> Organization:
    """Organization with seat-based pricing enabled, linked to the test user."""
    org = await create_organization(
        save_fixture,
        feature_settings={"seat_based_pricing_enabled": True},
    )
    await save_fixture(UserOrganization(user=user, organization=org))
    return org


@pytest_asyncio.fixture
async def seat_product(save_fixture: SaveFixture, seat_org: Organization) -> Product:
    product = await create_product(
        save_fixture,
        organization=seat_org,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],
        name="E2E Team Plan",
        is_tax_applicable=False,
    )
    seat_price = ProductPriceSeatUnit(
        price_currency="usd",
        seat_tiers={
            "tiers": [
                {"min_seats": 1, "max_seats": 5, "price_per_seat": 1000},
                {"min_seats": 6, "max_seats": 10, "price_per_seat": 800},
                {"min_seats": 11, "max_seats": None, "price_per_seat": 500},
            ],
        },
        product=product,
    )
    await save_fixture(seat_price)
    product.prices.append(seat_price)
    product.all_prices.append(seat_price)
    await save_fixture(product)
    return product
