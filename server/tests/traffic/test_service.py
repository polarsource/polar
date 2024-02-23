import datetime

import pytest

from polar.kit.extensions.sqlalchemy import sql
from polar.models.article import Article
from polar.models.organization import Organization
from polar.models.traffic import Traffic
from polar.postgres import AsyncSession
from polar.traffic.schemas import TrafficStatisticsPeriod
from polar.traffic.service import traffic_service


@pytest.mark.asyncio
async def test_article_add(
    session: AsyncSession,
    article: Article,
    organization: Organization,
    second_organization: Organization,
) -> None:
    # then
    session.expunge_all()

    # 30 views in february
    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer=None,
            article_id=article.id,
            date=datetime.date(2024, 2, 19),
        )

    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=datetime.date(2024, 2, 19),
        )

    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=datetime.date(2024, 2, 20),
        )

    # traffic with both article and org id
    await traffic_service.add(
        session,
        location_href="https://polar.sh/hello",
        referrer="https://google.com/",
        article_id=article.id,
        organization_id=organization.id,
        date=datetime.date(2024, 2, 20),
    )

    # 5 views in november (outside of range)
    for i in range(50):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=datetime.date(2023, 11, 20),
        )

    # 8 views in december
    for i in range(4):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=datetime.date(2023, 12, 1),
        )
    for i in range(4):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=datetime.date(2023, 12, 31),
        )

    # traffic in other organization (no affect on result)
    await traffic_service.add(
        session,
        location_href="https://polar.sh/hello",
        referrer="https://google.com/",
        organization_id=second_organization.id,
        date=datetime.date(2024, 2, 19),
    )

    monthly = await traffic_service.views_statistics(
        session,
        article_ids=[article.id],
        start_date=datetime.date(2023, 12, 1),
        end_date=datetime.date(2024, 3, 1),
        interval="month",
        start_of_last_period=datetime.date(2024, 2, 1),
        group_by_article=False,
    )

    assert [
        TrafficStatisticsPeriod(
            start_date=datetime.date(2023, 12, 1),
            end_date=datetime.date(2024, 1, 1),
            views=8,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 1, 1),
            end_date=datetime.date(2024, 2, 1),
            views=0,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 1),
            end_date=datetime.date(2024, 3, 1),
            views=31,
            article_id=None,
        ),
    ] == monthly

    daily = await traffic_service.views_statistics(
        session,
        article_ids=[article.id],
        start_date=datetime.date(2024, 2, 17),
        end_date=datetime.date(2024, 2, 25),
        interval="day",
        start_of_last_period=datetime.date(2024, 2, 20),
        group_by_article=False,
    )

    assert [
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 17),
            end_date=datetime.date(2024, 2, 18),
            views=0,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 18),
            end_date=datetime.date(2024, 2, 19),
            views=0,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 19),
            end_date=datetime.date(2024, 2, 20),
            views=20,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 20),
            end_date=datetime.date(2024, 2, 21),
            views=11,
            article_id=None,
        ),
    ] == daily

    # assert db deduplication
    stmt = sql.select(Traffic).order_by(Traffic.date)
    r = await session.execute(stmt)
    assert 8 == len(r.scalars().unique().all())


@pytest.mark.asyncio
async def test_organization_add(
    session: AsyncSession,
    organization: Organization,
    second_organization: Organization,
    article: Article,
) -> None:
    # then
    session.expunge_all()

    # 15 views in february
    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer=None,
            organization_id=organization.id,
            date=datetime.date(2024, 2, 19),
        )

    for i in range(5):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            organization_id=organization.id,
            date=datetime.date(2024, 2, 19),
        )

    # 1 page view that has both article and organization ids
    await traffic_service.add(
        session,
        location_href="https://polar.sh/hello",
        referrer="https://google.com/",
        organization_id=organization.id,
        article_id=article.id,
        date=datetime.date(2024, 2, 19),
    )

    # traffic in other organization (no affect on result)
    await traffic_service.add(
        session,
        location_href="https://polar.sh/hello",
        referrer="https://google.com/",
        organization_id=second_organization.id,
        date=datetime.date(2024, 2, 19),
    )

    monthly = await traffic_service.views_statistics(
        session,
        organization_id=organization.id,
        start_date=datetime.date(2023, 12, 1),
        end_date=datetime.date(2024, 3, 1),
        interval="month",
        start_of_last_period=datetime.date(2024, 2, 1),
        group_by_article=False,
    )

    assert [
        TrafficStatisticsPeriod(
            start_date=datetime.date(2023, 12, 1),
            end_date=datetime.date(2024, 1, 1),
            views=0,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 1, 1),
            end_date=datetime.date(2024, 2, 1),
            views=0,
            article_id=None,
        ),
        TrafficStatisticsPeriod(
            start_date=datetime.date(2024, 2, 1),
            end_date=datetime.date(2024, 3, 1),
            views=16,
            article_id=None,
        ),
    ] == monthly

    # assert db deduplication
    stmt = sql.select(Traffic).order_by(Traffic.date)
    r = await session.execute(stmt)
    assert 4 == len(r.scalars().unique().all())
