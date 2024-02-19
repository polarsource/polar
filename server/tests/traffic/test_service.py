import datetime

import pytest

from polar.models.article import Article
from polar.postgres import AsyncSession
from polar.traffic.service import traffic_service


@pytest.mark.asyncio
async def test_article_add(
    session: AsyncSession,
    article: Article,
) -> None:
    # then
    session.expunge_all()

    d = datetime.date(2024, 2, 19)

    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer=None,
            article_id=article.id,
            date=d,
        )

    for i in range(10):
        await traffic_service.add(
            session,
            location_href="https://polar.sh/hello",
            referrer="https://google.com/",
            article_id=article.id,
            date=d,
        )

    t = await traffic_service.views_statistics(
        session,
        article_id=article.id,
        start_date=d,
        end_date=d,
    )

    assert t
    assert 1 == len(t)
    assert 20 == t[0].views
