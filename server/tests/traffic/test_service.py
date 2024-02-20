import datetime

import pytest

from polar.models.article import Article
from polar.postgres import AsyncSession
from polar.traffic.schemas import TrafficStatisticsPeriod
from polar.traffic.service import traffic_service


@pytest.mark.asyncio
async def test_article_add(
    session: AsyncSession,
    article: Article,
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
            views=30,
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
            views=10,
            article_id=None,
        ),
    ] == daily
