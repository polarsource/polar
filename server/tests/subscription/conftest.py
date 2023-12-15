import random
import string
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.app import app
from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Organization,
    Repository,
    Subscription,
    SubscriptionBenefit,
    SubscriptionTier,
    SubscriptionTierBenefit,
    User,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.models.subscription_tier import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.subscription.endpoints import is_feature_flag_enabled
from tests.fixtures.random_objects import create_organization, create_user


def rstr(prefix: str) -> str:
    return f"{prefix}.{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch(
        "polar.subscription.service.subscription_tier.stripe_service", new=mock
    )
    mocker.patch(
        "polar.subscription.service.subscribe_session.stripe_service", new=mock
    )
    mocker.patch("polar.subscription.service.subscription.stripe_service", new=mock)
    return mock


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
    price_amount: int = 1000,
    is_highlighted: bool = False,
    is_archived: bool = False,
) -> SubscriptionTier:
    assert (organization is not None) != (repository is not None)
    subscription_tier = SubscriptionTier(
        type=type,
        name=name,
        price_amount=price_amount,
        price_currency="USD",
        is_highlighted=is_highlighted,
        is_archived=is_archived,
        organization_id=organization.id if organization is not None else None,
        repository_id=repository.id if repository is not None else None,
        stripe_product_id=rstr("PRODUCT_ID"),
        stripe_price_id=rstr("PRICE_ID"),
        subscription_tier_benefits=[],
        description="x",
    )
    session.add(subscription_tier)
    await session.commit()
    return subscription_tier


async def create_subscription_benefit(
    session: AsyncSession,
    *,
    type: SubscriptionBenefitType = SubscriptionBenefitType.custom,
    is_tax_applicable: bool | None = None,
    organization: Organization | None = None,
    repository: Repository | None = None,
    description: str = "Subscription Benefit",
    selectable: bool = True,
    deletable: bool = True,
    properties: dict[str, Any] = {},
) -> SubscriptionBenefit:
    assert (organization is not None) != (repository is not None)
    subscription_benefit = SubscriptionBenefit(
        type=type,
        description=description,
        is_tax_applicable=is_tax_applicable if is_tax_applicable is not None else False,
        organization_id=organization.id if organization is not None else None,
        repository_id=repository.id if repository is not None else None,
        selectable=selectable,
        deletable=deletable,
        properties=properties,
    )
    session.add(subscription_benefit)
    await session.commit()
    return subscription_benefit


async def add_subscription_benefits(
    session: AsyncSession,
    *,
    subscription_tier: SubscriptionTier,
    subscription_benefits: list[SubscriptionBenefit],
) -> SubscriptionTier:
    subscription_tier.subscription_tier_benefits = []
    for order, subscription_benefit in enumerate(subscription_benefits):
        benefit = SubscriptionTierBenefit(
            subscription_tier_id=subscription_tier.id,
            subscription_benefit_id=subscription_benefit.id,
            order=order,
        )

        subscription_tier.subscription_tier_benefits.append(benefit)
    session.add(subscription_tier)
    await session.commit()
    return subscription_tier


async def create_subscription(
    session: AsyncSession,
    *,
    subscription_tier: SubscriptionTier,
    user: User,
    organization: Organization | None = None,
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
) -> Subscription:
    now = datetime.now(UTC)
    subscription = Subscription(
        stripe_subscription_id=stripe_subscription_id,
        status=status,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
        started_at=started_at,
        ended_at=ended_at,
        price_amount=subscription_tier.price_amount,
        price_currency=subscription_tier.price_currency,
        user_id=user.id,
        organization_id=organization.id if organization is not None else None,
        subscription_tier_id=subscription_tier.id,
    )
    session.add(subscription)
    await session.commit()
    return subscription


async def create_active_subscription(
    session: AsyncSession,
    *,
    subscription_tier: SubscriptionTier,
    user: User,
    organization: Organization | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
) -> Subscription:
    return await create_subscription(
        session,
        subscription_tier=subscription_tier,
        user=user,
        organization=organization,
        status=SubscriptionStatus.active,
        started_at=started_at or utc_now(),
        ended_at=ended_at,
        stripe_subscription_id=stripe_subscription_id,
    )


@pytest_asyncio.fixture
async def subscription_tier_organization_free(
    session: AsyncSession, organization: Organization
) -> SubscriptionTier:
    return await create_subscription_tier(
        session,
        type=SubscriptionTierType.free,
        price_amount=0,
        organization=organization,
    )


@pytest_asyncio.fixture
async def subscription_tier_organization(
    session: AsyncSession, organization: Organization
) -> SubscriptionTier:
    return await create_subscription_tier(session, organization=organization)


@pytest_asyncio.fixture
async def subscription_tier_organization_second(
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
    subscription_tier_organization_second: SubscriptionTier,
    subscription_tier_organization_free: SubscriptionTier,
    subscription_tier_repository: SubscriptionTier,
    subscription_tier_private_repository: SubscriptionTier,
) -> list[SubscriptionTier]:
    return [
        subscription_tier_organization_free,
        subscription_tier_organization,
        subscription_tier_organization_second,
        subscription_tier_repository,
        subscription_tier_private_repository,
    ]


@pytest_asyncio.fixture
async def subscription_benefit_organization(
    session: AsyncSession, organization: Organization
) -> SubscriptionBenefit:
    return await create_subscription_benefit(session, organization=organization)


@pytest_asyncio.fixture
async def subscription_benefit_repository(
    session: AsyncSession, public_repository: Repository
) -> SubscriptionBenefit:
    return await create_subscription_benefit(session, repository=public_repository)


@pytest_asyncio.fixture
async def subscription_benefit_private_repository(
    session: AsyncSession, repository: Repository
) -> SubscriptionBenefit:
    return await create_subscription_benefit(
        session, type=SubscriptionBenefitType.custom, repository=repository
    )


@pytest_asyncio.fixture
async def subscription_benefits(
    subscription_benefit_organization: SubscriptionBenefit,
    subscription_benefit_repository: SubscriptionBenefit,
    subscription_benefit_private_repository: SubscriptionBenefit,
) -> list[SubscriptionBenefit]:
    return [
        subscription_benefit_organization,
        subscription_benefit_repository,
        subscription_benefit_private_repository,
    ]


@pytest_asyncio.fixture
async def organization_account(
    session: AsyncSession, organization: Organization, user: User
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        stripe_id="STRIPE_ACCOUNT_ID",
    )
    session.add(account)
    organization.account = account
    session.add(organization)
    await session.commit()
    return account


@pytest_asyncio.fixture
async def organization_subscriber(session: AsyncSession) -> Organization:
    return await create_organization(session)


@pytest_asyncio.fixture
async def organization_subscriber_admin(
    session: AsyncSession, organization_subscriber: Organization, user_second: User
) -> User:
    user_organization = UserOrganization(
        user_id=user_second.id,
        organization_id=organization_subscriber.id,
        is_admin=True,
    )
    session.add(user_organization)
    await session.commit()
    return user_second


@pytest_asyncio.fixture
async def organization_subscriber_members(
    session: AsyncSession, organization_subscriber: Organization
) -> list[User]:
    users: list[User] = []
    for _ in range(5):
        user = await create_user(session)
        user_organization = UserOrganization(
            user_id=user.id,
            organization_id=organization_subscriber.id,
            is_admin=False,
        )
        session.add(user_organization)
        users.append(user)
    await session.commit()
    return users


@pytest_asyncio.fixture
async def subscription(
    session: AsyncSession, subscription_tier_organization: SubscriptionTier, user: User
) -> Subscription:
    return await create_subscription(
        session, subscription_tier=subscription_tier_organization, user=user
    )


@pytest_asyncio.fixture
async def subscription_organization(
    session: AsyncSession,
    subscription_tier_organization: SubscriptionTier,
    organization_subscriber: Organization,
    user_second: User,
) -> Subscription:
    return await create_subscription(
        session,
        subscription_tier=subscription_tier_organization,
        user=user_second,
        organization=organization_subscriber,
    )
