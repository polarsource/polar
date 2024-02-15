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
        await traffic_service.add(session, article_id=article.id, date=d)

    t = await traffic_service.get(session, article_id=article.id, date=d)

    assert t
    assert 10 == t.views
