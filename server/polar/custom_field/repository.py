from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, delete, func, or_, select, update
from sqlalchemy.orm import contains_eager

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import CustomField, Organization
from polar.models.custom_field import CustomFieldType

from .attachment import attached_custom_fields_models
from .data import custom_field_data_models
from .sorting import CustomFieldSortProperty


class CustomFieldRepository(
    RepositorySortingMixin[CustomField, CustomFieldSortProperty],
    RepositorySoftDeletionIDMixin[CustomField, UUID],
    RepositorySoftDeletionMixin[CustomField],
    RepositoryBase[CustomField],
):
    model = CustomField

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[CustomField]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .join(Organization, Organization.id == CustomField.organization_id)
            .options(contains_eager(CustomField.organization))
        )

    def get_by_org_ids_statement(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[CustomField]]:
        """Filter to custom fields owned by the given organizations."""
        return self.get_base_statement().where(CustomField.organization_id.in_(org_ids))

    def apply_query_filter(
        self,
        statement: Select[tuple[CustomField]],
        *,
        organization_id: Sequence[UUID] | None = None,
        query: str | None = None,
        type: Sequence[CustomFieldType] | None = None,
    ) -> Select[tuple[CustomField]]:
        if organization_id is not None:
            statement = statement.where(
                CustomField.organization_id.in_(organization_id)
            )
        if query is not None:
            statement = statement.where(
                or_(
                    CustomField.name.ilike(f"%{query}%"),
                    CustomField.slug.ilike(f"%{query}%"),
                )
            )
        if type is not None:
            statement = statement.where(CustomField.type.in_(type))
        return statement

    async def get_by_organization_id_and_slug(
        self, organization_id: UUID, slug: str
    ) -> CustomField | None:
        statement = select(CustomField).where(
            CustomField.organization_id == organization_id,
            CustomField.slug == slug,
        )
        return await self.get_one_or_none(statement)

    async def rename_slug_in_attached_data(
        self,
        custom_field: CustomField,
        previous_slug: str,
    ) -> None:
        """Rename ``previous_slug`` to ``custom_field.slug`` inside every
        ``custom_field_data`` JSONB column on attached models for the same org."""
        for model in custom_field_data_models:
            statement = (
                update(model)
                .where(
                    model.organization == custom_field.organization,
                    model.custom_field_data.has_key(previous_slug),
                )
                .values(
                    custom_field_data=(
                        model.custom_field_data.op("-")(previous_slug)
                    ).op("||")(
                        func.jsonb_build_object(
                            custom_field.slug,
                            model.custom_field_data[previous_slug],
                        )
                    )
                )
            )
            await self.session.execute(statement)

    async def detach_from_all(self, custom_field_id: UUID) -> None:
        """Remove every association-table row pointing at this custom field."""
        for model in attached_custom_fields_models:
            statement = delete(model).where(model.custom_field_id == custom_field_id)
            await self.session.execute(statement)

    def get_sorting_clause(self, property: CustomFieldSortProperty) -> SortingClause:
        if property == CustomFieldSortProperty.created_at:
            return CustomField.created_at
        if property == CustomFieldSortProperty.slug:
            return CustomField.slug
        if property == CustomFieldSortProperty.custom_field_name:
            return CustomField.name
        if property == CustomFieldSortProperty.type:
            return CustomField.type
        raise NotImplementedError(property)
