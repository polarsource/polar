from typing import cast
from uuid import UUID

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Benefit
from polar.models.benefit import BenefitDownloadablesProperties
from polar.postgres import AsyncSession, sql


def get_ids_from_files_properties(
    properties: BenefitDownloadablesProperties,
) -> list[UUID]:
    ids = []
    files = properties.get("files", [])
    for file_id in files:
        if not isinstance(file_id, UUID):
            file_id = UUID(file_id)
        ids.append(file_id)
    return ids


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

    async def get_file_ids(
        self,
    ) -> list[UUID]:
        benefit = await self.get_or_raise()
        return get_ids_from_files_properties(
            cast(BenefitDownloadablesProperties, benefit.properties)
        )

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
