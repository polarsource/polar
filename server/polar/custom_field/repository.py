from uuid import UUID

from sqlalchemy import Select, select

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
        statement = self.get_current_statement(organization_id).where(
            CustomField.slug == slug
        )
        return await self.get_one_or_none(statement)

    def get_current_statement(self, organization_id: UUID) -> Select[CustomField]:
        return (
            self.get_base_statement()
            .where(
                CustomField.organization_id == organization_id,
                CustomField.is_current,
            )
            .order_by(CustomField.created_at, CustomField.id)
        )

    async def has_versions(self, custom_field: CustomField) -> bool:
        statement = select(
            self.get_base_statement()
            .where(
                CustomField.organization_id == custom_field.organization_id,
                CustomField.slug == custom_field.slug,
                CustomField.id != custom_field.id,
            )
            .exists()
        )
        result = await self.session.execute(statement)
        return result.scalar_one()
