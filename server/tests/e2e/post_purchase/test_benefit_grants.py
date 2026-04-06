"""
E2E: Post-purchase — benefit grants.

After a one-time purchase, benefits attached to the product are granted
to the customer via the drain pipeline. Each benefit type has its own
strategy that executes during the grant task.
"""

import uuid
from typing import Any

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrant
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.e2e.purchase.conftest import complete_purchase
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_meter,
    create_product,
    set_product_benefits,
)


async def _get_grants(session: AsyncSession, order_id: str) -> list[BenefitGrant]:
    """Query all benefit grants for an order."""
    result = await session.execute(
        select(BenefitGrant)
        .where(BenefitGrant.order_id == uuid.UUID(order_id))
        .options(joinedload(BenefitGrant.benefit))
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def product_with_custom_benefit(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Custom Benefit Product",
        prices=[(1000, "usd")],
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.custom,
        description="Welcome note",
        properties={"note": "Thanks for purchasing!"},
    )
    return await set_product_benefits(save_fixture, product=product, benefits=[benefit])


@pytest_asyncio.fixture
async def product_with_license_key(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E License Key Product",
        prices=[(2000, "usd")],
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.license_keys,
        description="License key",
        properties={
            "prefix": "E2E",
            "activations": {"limit": 5, "enable_customer_admin": False},
            "expires": None,
            "limit_usage": None,
        },
    )
    return await set_product_benefits(save_fixture, product=product, benefits=[benefit])


@pytest_asyncio.fixture
async def product_with_meter_credit(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    meter = await create_meter(
        save_fixture,
        organization=organization,
        id=uuid.uuid4(),
        name="E2E API Credits",
    )
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Meter Credit Product",
        prices=[(500, "usd")],
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.meter_credit,
        description="100 API credits",
        properties={"meter_id": str(meter.id), "units": 100, "rollover": False},
    )
    return await set_product_benefits(save_fixture, product=product, benefits=[benefit])


@pytest_asyncio.fixture
async def product_with_feature_flag(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Feature Flag Product",
        prices=[(800, "usd")],
    )
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.feature_flag,
        description="Pro features",
        properties={},
    )
    return await set_product_benefits(save_fixture, product=product, benefits=[benefit])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBenefitGrants:
    @E2E_AUTH
    async def test_custom_benefit_granted(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        product_with_custom_benefit: Product,
    ) -> None:
        # Given a product with a custom benefit attached
        # When the customer purchases it
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            product_with_custom_benefit,
            amount=1000,
        )

        # Then the grant is created
        grants = await _get_grants(session, result.order_id)
        assert len(grants) == 1
        assert grants[0].is_granted
        assert grants[0].benefit.type == BenefitType.custom

    @E2E_AUTH
    async def test_license_key_generated(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        product_with_license_key: Product,
    ) -> None:
        # Given a product with a license key benefit (prefix "E2E", 5 activations)
        # When the customer purchases it
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            product_with_license_key,
            amount=2000,
        )

        # Then a license key is generated and stored on the grant
        grants = await _get_grants(session, result.order_id)
        assert len(grants) == 1
        grant = grants[0]
        assert grant.is_granted
        assert grant.benefit.type == BenefitType.license_keys
        props: dict[str, Any] = grant.properties  # type: ignore[assignment]
        assert props["license_key_id"] is not None
        assert props["display_key"] is not None

    @E2E_AUTH
    async def test_meter_credit_applied(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        product_with_meter_credit: Product,
    ) -> None:
        # Given a product with a meter credit benefit (100 API credits)
        # When the customer purchases it
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            product_with_meter_credit,
            amount=500,
        )

        # Then 100 credits are applied to the meter
        grants = await _get_grants(session, result.order_id)
        assert len(grants) == 1
        grant = grants[0]
        assert grant.is_granted
        assert grant.benefit.type == BenefitType.meter_credit
        props: dict[str, Any] = grant.properties  # type: ignore[assignment]
        assert props["last_credited_units"] == 100

    @E2E_AUTH
    async def test_feature_flag_granted(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        product_with_feature_flag: Product,
    ) -> None:
        # Given a product with a feature flag benefit
        # When the customer purchases it
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            product_with_feature_flag,
            amount=800,
        )

        # Then the grant exists (presence = access)
        grants = await _get_grants(session, result.order_id)
        assert len(grants) == 1
        assert grants[0].is_granted
        assert grants[0].benefit.type == BenefitType.feature_flag
