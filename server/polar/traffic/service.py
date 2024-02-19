import datetime
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func

from polar.models.traffic import Traffic
from polar.postgres import AsyncSession, sql
from polar.traffic.schemas import TrafficStatisticsPeriod


class TrafficService:
    async def add(
        self,
        session: AsyncSession,
        location_href: str,
        referrer: str | None,
        article_id: UUID,
        date: datetime.date,
    ) -> None:
        insert_stmt = sql.insert(Traffic).values(
            location_href=location_href,
            referrer=referrer,
            article_id=article_id,
            date=date,
            views=1,
        )

        do_update = insert_stmt.on_conflict_do_update(
            constraint="traffic_article_id_date_location_href_referrer_key",
            set_=dict(views=Traffic.views + 1),
        )

        await session.execute(do_update)
        await session.commit()

    async def views_statistics(
        self,
        session: AsyncSession,
        article_id: UUID,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> Sequence[TrafficStatisticsPeriod]:
        stmt = (
            sql.select(
                Traffic.article_id, func.sum(Traffic.views).label("period_views")
            )
            .where(
                Traffic.article_id == article_id,
                Traffic.date >= start_date,
                Traffic.date <= end_date,
            )
            .group_by(Traffic.article_id, Traffic.date)
            .order_by(Traffic.date)
        )

        res = await session.execute(stmt)

        return [
            TrafficStatisticsPeriod(
                start_date=start_date,
                end_date=end_date,
                article_id=article_id,
                views=views,
            )
            for (article_id, views) in res.tuples().all()
        ]


traffic_service = TrafficService()
