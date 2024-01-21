import asyncio
from typing import cast

import pytest

from polar.article.service import article_service
from polar.models import Organization, Subscription, SubscriptionTier, User
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_benefit import (
    SubscriptionBenefitArticles,
    SubscriptionBenefitType,
)
from polar.postgres import AsyncSession
from polar.subscription.service.benefits.articles import (
    SubscriptionBenefitArticlesService,
)
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from tests.fixtures.random_objects import (
    create_subscription,
    create_subscription_benefit,
    create_subscription_benefit_grant,
)


@pytest.mark.parametrize("repeat", range(5))
@pytest.mark.asyncio
async def test_concurrent_subscription_upgrade(
    repeat: int,
    session: AsyncSession,
    user: User,
    organization: Organization,
    subscription_tier_organization: SubscriptionTier,
) -> None:
    previous_subscription = await create_subscription(
        session,
        subscription_tier=subscription_tier_organization,
        user=user,
        status=SubscriptionStatus.canceled,
    )
    previous_benefit = await create_subscription_benefit(
        session,
        type=SubscriptionBenefitType.articles,
        organization=organization,
        properties={"paid_articles": False},
    )
    await create_subscription_benefit_grant(
        session, user, previous_subscription, previous_benefit
    )

    new_subscription = await create_subscription(
        session,
        subscription_tier=subscription_tier_organization,
        user=user,
        status=SubscriptionStatus.active,
    )
    new_benefit = await create_subscription_benefit(
        session,
        type=SubscriptionBenefitType.articles,
        organization=organization,
        properties={"paid_articles": True},
    )

    session.expunge_all()

    async def do_grant() -> None:
        _benefit = cast(
            SubscriptionBenefitArticles,
            await subscription_benefit_service.get(session, new_benefit.id),
        )
        _subscription = await session.get(Subscription, new_subscription.id)
        _user = await session.get(User, user.id)
        assert _benefit is not None
        assert _subscription is not None
        assert _user is not None
        service = SubscriptionBenefitArticlesService(session)
        await service.grant(_benefit, _subscription, _user, {})

    async def do_revoke() -> None:
        _benefit = cast(
            SubscriptionBenefitArticles,
            await subscription_benefit_service.get(session, previous_benefit.id),
        )
        _subscription = await session.get(Subscription, previous_subscription.id)
        _user = await session.get(User, user.id)
        assert _benefit is not None
        assert _subscription is not None
        assert _user is not None
        service = SubscriptionBenefitArticlesService(session)
        await service.revoke(_benefit, _subscription, _user, {})

    # Mimic a race condition by running them concurrently
    async with asyncio.TaskGroup() as tg:
        revoke_task = tg.create_task(do_revoke())
        grant_task = tg.create_task(do_grant())

    article_subscription = await article_service.get_subscriber(
        session, user.id, organization.id
    )
    assert article_subscription is not None
    assert article_subscription.deleted_at is None
    assert article_subscription.paid_subscriber is True
