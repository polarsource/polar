import datetime
from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, func, null, text

from polar.kit.utils import utc_now
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
        article_ids: list[UUID],
        start_date: datetime.date,
        end_date: datetime.date,
        interval: Literal["month", "week", "day"],
        group_by_article: bool,
        start_of_last_period: datetime.date | None = None,
    ) -> Sequence[TrafficStatisticsPeriod]:
        interval_txt = {
            "month": "interval 'P1M'",
            "week": "interval 'P1W'",
            "day": "interval 'P1D'",
        }[interval]

        sql_interval = text(interval_txt)

        start_date_column = func.generate_series(
            start_date, end_date, sql_interval
        ).column_valued("start_date")
        end_date_column = start_date_column + sql_interval

        start_of_last_period = start_of_last_period or utc_now().date().replace(day=1)

        stmt = (
            sql.select(
                start_date_column,
            )
            .add_columns(
                end_date_column,
                Traffic.article_id if group_by_article else null(),
                # func.sum(Traffic.views).label("period_views"),
                func.coalesce(
                    func.sum(Traffic.views).filter(
                        Traffic.date >= start_date_column,
                        Traffic.date < end_date_column,
                    ),
                    0,
                ),
            )
            .join(
                Traffic,
                onclause=and_(
                    Traffic.article_id.in_(article_ids),
                ),
            )
            .where(start_date_column <= start_of_last_period)
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        res = await session.execute(stmt)

        return [
            TrafficStatisticsPeriod(
                start_date=row_start_date,
                end_date=row_end_date,
                article_id=article_id,
                views=views,
            )
            for (row_start_date, row_end_date, article_id, views) in res.tuples().all()
        ]


traffic_service = TrafficService()
