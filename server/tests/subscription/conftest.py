from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.app import app
from polar.integrations.stripe.service import StripeService
from polar.models import (
    Account,
    Organization,
    Repository,
    Subscription,
    SubscriptionTier,
    User,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.subscription.endpoints import is_feature_flag_enabled


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.subscription.service.subscription_tier.stripe_service",
        spec=StripeService,
    )


@pytest.fixture(autouse=True, scope="package")
def override_is_feature_flag_enabled() -> Iterator[None]:
    app.dependency_overrides[is_feature_flag_enabled] = lambda: True

    yield

    app.dependency_overrides.pop(is_feature_flag_enabled)


async def create_subscription_tier(
    session: AsyncSession,
    *,
    type: SubscriptionTierType = SubscriptionTierType.hobby,
    organization: Organization | None = None,
    repository: Repository | None = None,
    name: str = "Subscription Tier",
    is_highlighted: bool = False,
) -> SubscriptionTier:
    assert (organization is not None) != (repository is not None)
    subscription_tier = SubscriptionTier(
        type=type,
        name=name,
        price_amount=1000,
        price_currency="USD",
        is_highlighted=is_highlighted,
        organization_id=organization.id if organization is not None else None,
        repository_id=repository.id if repository is not None else None,
        stripe_product_id="PRODUCT_ID",
        stripe_price_id="PRICE_ID",
    )
    session.add(subscription_tier)
    await session.commit()
    return subscription_tier


async def create_subscription(
    session: AsyncSession,
    *,
    subscription_tier: SubscriptionTier,
    user: User,
    stripe_subscription_id: str = "SUBSCRIPTION_ID",
) -> Subscription:
    now = datetime.now(UTC)
    subscription = Subscription(
        stripe_subscription_id=stripe_subscription_id,
        status=SubscriptionStatus.incomplete,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
        ended_at=None,
        price_amount=subscription_tier.price_amount,
        price_currency=subscription_tier.price_currency,
        user_id=user.id,
        subscription_tier_id=subscription_tier.id,
    )
    session.add(subscription)
    await session.commit()
    return subscription


@pytest_asyncio.fixture
async def subscription_tier_organization(
    session: AsyncSession, organization: Organization
) -> SubscriptionTier:
    return await create_subscription_tier(session, organization=organization)


@pytest_asyncio.fixture
async def subscription_tier_repository(
    session: AsyncSession, public_repository: Repository
) -> SubscriptionTier:
    return await create_subscription_tier(session, repository=public_repository)


@pytest_asyncio.fixture
async def subscription_tier_private_repository(
    session: AsyncSession, repository: Repository
) -> SubscriptionTier:
    return await create_subscription_tier(
        session, type=SubscriptionTierType.business, repository=repository
    )


@pytest_asyncio.fixture
async def subscription_tiers(
    subscription_tier_organization: SubscriptionTier,
    subscription_tier_repository: SubscriptionTier,
    subscription_tier_private_repository: SubscriptionTier,
) -> list[SubscriptionTier]:
    return [
        subscription_tier_organization,
        subscription_tier_repository,
        subscription_tier_private_repository,
    ]


@pytest_asyncio.fixture
async def organization_account(
    session: AsyncSession, organization: Organization, user: User
) -> Account:
    return await Account.create(
        session,
        account_type="stripe",
        organization_id=organization.id,
        admin_id=user.id,
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
