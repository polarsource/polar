import asyncio
from typing import cast

import pytest

from polar.article.service import article_service
from polar.benefit.benefits.articles import BenefitArticlesService
from polar.benefit.service.benefit import benefit as benefit_service
from polar.models import Organization, Product, User
from polar.models.benefit import (
    BenefitArticles,
    BenefitType,
)
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_subscription,
)


@pytest.mark.parametrize("repeat", range(5))
@pytest.mark.asyncio
async def test_concurrent_subscription_upgrade(
    repeat: int,
    session: AsyncSession,
    save_fixture: SaveFixture,
    user: User,
    organization: Organization,
    subscription_tier: Product,
) -> None:
    previous_subscription = await create_subscription(
        save_fixture,
        subscription_tier=subscription_tier,
        user=user,
        status=SubscriptionStatus.canceled,
    )
    previous_benefit = await create_benefit(
        save_fixture,
        type=BenefitType.articles,
        organization=organization,
        properties={"paid_articles": False},
    )
    await create_benefit_grant(
        save_fixture,
        user,
        previous_benefit,
        subscription=previous_subscription,
    )

    new_benefit = await create_benefit(
        save_fixture,
        type=BenefitType.articles,
        organization=organization,
        properties={"paid_articles": True},
    )

    session.expunge_all()

    async def do_grant() -> None:
        _benefit = cast(
            BenefitArticles, await benefit_service.get(session, new_benefit.id)
        )
        _user = await session.get(User, user.id)
        assert _benefit is not None
        assert _user is not None
        service = BenefitArticlesService(session)
        await service.grant(_benefit, _user, {})

    async def do_revoke() -> None:
        _benefit = cast(
            BenefitArticles, await benefit_service.get(session, previous_benefit.id)
        )
        _user = await session.get(User, user.id)
        assert _benefit is not None
        assert _user is not None
        service = BenefitArticlesService(session)
        await service.revoke(_benefit, _user, {})

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
