from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Organization, Repository, SubscriptionGroup, SubscriptionTier
from polar.postgres import AsyncSession


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.subscription.service.subscription_tier.stripe_service",
        spec=StripeService,
    )


async def create_subscription_group(
    session: AsyncSession,
    *,
    name: str = "Subscription Group",
    order: int = 1,
    organization: Organization | None = None,
    repository: Repository | None = None,
) -> SubscriptionGroup:
    assert (organization is not None) != (repository is not None)
    subscription_group = SubscriptionGroup(
        name=name,
        order=order,
        organization_id=organization.id if organization is not None else None,
        repository_id=repository.id if repository is not None else None,
    )
    session.add(subscription_group)
    await session.commit()
    return subscription_group


async def create_subscription_tier(
    session: AsyncSession,
    *,
    subscription_group: SubscriptionGroup,
    name: str = "Subscription Tier",
) -> SubscriptionTier:
    subscription_tier = SubscriptionTier(
        name=name,
        price_amount=1000,
        price_currency="USD",
        subscription_group_id=subscription_group.id,
        stripe_product_id="PRODUCT_ID",
        stripe_price_id="PRICE_ID",
    )
    session.add(subscription_tier)
    await session.commit()
    return subscription_tier


@pytest_asyncio.fixture
async def subscription_group_organization(
    session: AsyncSession, organization: Organization
) -> SubscriptionGroup:
    return await create_subscription_group(session, organization=organization)


@pytest_asyncio.fixture
async def subscription_group_repository(
    session: AsyncSession, public_repository: Repository
) -> SubscriptionGroup:
    return await create_subscription_group(session, repository=public_repository)


@pytest_asyncio.fixture
async def subscription_group_private_repository(
    session: AsyncSession, repository: Repository
) -> SubscriptionGroup:
    return await create_subscription_group(session, repository=repository)


@pytest_asyncio.fixture
async def subscription_groups(
    subscription_group_organization: SubscriptionGroup,
    subscription_group_repository: SubscriptionGroup,
    subscription_group_private_repository: SubscriptionGroup,
) -> list[SubscriptionGroup]:
    return [
        subscription_group_organization,
        subscription_group_repository,
        subscription_group_private_repository,
    ]


@pytest_asyncio.fixture
async def subscription_tier_organization(
    session: AsyncSession, subscription_group_organization: SubscriptionGroup
) -> SubscriptionTier:
    return await create_subscription_tier(
        session, subscription_group=subscription_group_organization
    )


@pytest_asyncio.fixture
async def subscription_tiers(
    subscription_tier_organization: SubscriptionTier,
) -> list[SubscriptionTier]:
    return [
        subscription_tier_organization,
    ]
