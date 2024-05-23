from uuid import UUID

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Benefit
from polar.postgres import AsyncSession, sql


class BenefitDownloadablesFiles:
    def __init__(self, session: AsyncSession, benefit_id: UUID):
        self.session = session
        self.benefit_id = benefit_id

        self._benefit: Benefit | None = None

    async def get_or_raise(self) -> Benefit:
        benefit = await self._fetch_benefit()
        if benefit:
            return benefit

        raise ResourceNotFound()

    async def ensure_organization_matches(self, organization_id: UUID) -> None:
        benefit = await self.get_or_raise()
        if benefit.organization_id != organization_id:
            raise NotPermitted()

    async def get_property_files(self) -> list[UUID]:
        benefit = await self.get_or_raise()
        if not benefit:
            return []

        property_files = benefit.properties.get("files", [])
        property_files = list(map(UUID, property_files))
        return property_files

    async def get_file_ids(
        self,
    ) -> list[UUID]:
        return await self.get_property_files()

    async def sort_mapping[T](self, mapping: dict[UUID, T]) -> list[T]:
        file_ids = await self.get_file_ids()
        if not file_ids:
            return []

        ret = []
        for file_id in file_ids:
            val = mapping.get(file_id, None)
            if not val:
                continue

            ret.append(val)
        return ret

    async def _fetch_benefit(self) -> Benefit | None:
        if self._benefit is not None:
            return self._benefit

        query = sql.select(Benefit).where(
            Benefit.id == self.benefit_id,
            Benefit.deleted_at.is_(None),
        )

        benefit = None
        res = await self.session.execute(query)
        record = res.scalars().unique().one_or_none()
        if record:
            benefit = record

        self._benefit = benefit
        return self._benefit
