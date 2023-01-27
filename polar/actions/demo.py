from polar.actions.base import Action
from polar.models.demo import Demo
from polar.postgres import AsyncSession, sql
from polar.schema.demo import CreateDemo, UpdateDemo


class DeveloperActions(Action[Demo, CreateDemo, UpdateDemo]):
    async def get_all(self, session: AsyncSession) -> list[Demo]:
        query = sql.select(self.model)
        res = await session.execute(query)
        return res.scalars().all()


demo = DeveloperActions(Demo)
