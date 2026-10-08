from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CustomField


class CustomFieldRepository(
    RepositorySoftDeletionIDMixin[CustomField, UUID],
    RepositorySoftDeletionMixin[CustomField],
    RepositoryBase[CustomField],
):
    model = CustomField

    async def get_by_organization_and_slug(
        self, organization_id: UUID, slug: str
    ) -> CustomField | None:
        statement = self.get_base_statement().where(
            CustomField.organization_id == organization_id,
            CustomField.slug == slug,
        )
        return await self.get_one_or_none(statement)

    async def get_all_by_organization_and_slugs(
        self, organization_id: UUID, slugs: Sequence[str]
    ) -> Sequence[CustomField]:
        statement = self.get_base_statement().where(
            CustomField.organization_id == organization_id,
            CustomField.slug.in_(slugs),
        )
        return await self.get_all(statement)
