from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, or_, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Catalog, CatalogCustomField, CustomField
from polar.models.catalog import CatalogStatus


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

    async def get_current_by_slugs(
        self,
        organization_id: UUID,
        slugs: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[CustomField]:
        statement = self.get_current_statement(organization_id).where(
            CustomField.slug.in_(slugs)
        )
        if for_update:
            statement = statement.with_for_update(of=CustomField, key_share=True)
        return await self.get_all(statement)

    def apply_catalog_filter(
        self,
        statement: Select[CustomField],
        catalog_id: Sequence[UUID] | None,
        catalog_status: Sequence[CatalogStatus] | None,
    ) -> Select[CustomField]:
        catalog_members = (
            select(CatalogCustomField.custom_field_id)
            .join(CatalogCustomField.catalog)
            .where(
                CatalogCustomField.deleted_at.is_(None),
                Catalog.deleted_at.is_(None),
            )
        )
        if catalog_id is not None:
            statement = statement.where(
                CustomField.id.in_(catalog_members.where(Catalog.id.in_(catalog_id)))
            )
        if catalog_status is not None:
            in_status = CustomField.id.in_(
                catalog_members.where(Catalog.status.in_(catalog_status))
            )
            statement = statement.where(
                or_(CustomField.is_current, in_status)
                if CatalogStatus.live in catalog_status
                else in_status
            )
        return statement

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
