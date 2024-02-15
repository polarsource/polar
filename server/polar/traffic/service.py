import datetime
from uuid import UUID

from polar.models.traffic import Traffic
from polar.postgres import AsyncSession, sql


class TrafficService:
    async def add(
        self,
        session: AsyncSession,
        article_id: UUID,
        date: datetime.date,
    ) -> None:
        insert_stmt = sql.insert(Traffic).values(
            article_id=article_id,
            date=date,
            views=1,
        )

        do_update = insert_stmt.on_conflict_do_update(
            constraint="traffic_article_id_date_key", set_=dict(views=Traffic.views + 1)
        )

        await session.execute(do_update)
        await session.commit()

    async def get(
        self,
        session: AsyncSession,
        article_id: UUID,
        date: datetime.date,
    ) -> Traffic | None:
        stmt = sql.select(Traffic).where(
            Traffic.article_id == article_id,
            Traffic.date == date,
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()


traffic_service = TrafficService()
