import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import (
    Select,
    UnaryExpression,
    asc,
    delete,
    desc,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.custom_field.sorting import CustomFieldSortProperty
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import CustomField, Organization, User, UserOrganization
from polar.models.custom_field import CustomFieldType
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession

from .attachment import attached_custom_fields_models
from .data import custom_field_data_models
from .schemas import CustomFieldCreate, CustomFieldUpdate


class CustomFieldError(PolarError): ...


class CustomFieldService(ResourceServiceReader[CustomField]):
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        type: Sequence[CustomFieldType] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomFieldSortProperty]] = [
            (CustomFieldSortProperty.slug, False)
        ],
    ) -> tuple[Sequence[CustomField], int]:
        statement = self._get_readable_custom_field_statement(auth_subject)

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

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomFieldSortProperty.created_at:
                order_by_clauses.append(
                    clause_function(CustomFieldSortProperty.created_at)
                )
            elif criterion == CustomFieldSortProperty.slug:
                order_by_clauses.append(clause_function(CustomFieldSortProperty.slug))
            elif criterion == CustomFieldSortProperty.custom_field_name:
                order_by_clauses.append(
                    clause_function(CustomFieldSortProperty.custom_field_name)
                )
            elif criterion == CustomFieldSortProperty.type:
                order_by_clauses.append(clause_function(CustomFieldSortProperty.type))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CustomField | None:
        statement = self._get_readable_custom_field_statement(auth_subject).where(
            CustomField.id == id
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        custom_field_create: CustomFieldCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CustomField:
        organization = await get_payload_organization(
            session, auth_subject, custom_field_create
        )

        existing_field = await self._get_by_organization_id_and_slug(
            session, organization.id, custom_field_create.slug
        )
        if existing_field is not None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "slug"),
                        "msg": "Custom field with this slug already exists.",
                        "input": custom_field_create.slug,
                    }
                ]
            )

        custom_field = CustomField(
            **custom_field_create.model_dump(
                exclude={"organization_id"}, by_alias=True
            ),
            organization=organization,
        )
        session.add(custom_field)

        return custom_field

    async def update(
        self,
        session: AsyncSession,
        custom_field: CustomField,
        custom_field_update: CustomFieldUpdate,
    ) -> CustomField:
        if custom_field.type != custom_field_update.type:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "type"),
                        "msg": "The type of a custom field can't be changed.",
                        "input": custom_field_update.type,
                    }
                ]
            )

        if (
            custom_field_update.slug is not None
            and custom_field.slug != custom_field_update.slug
        ):
            existing_field = await self._get_by_organization_id_and_slug(
                session, custom_field.organization_id, custom_field_update.slug
            )
            if existing_field is not None and existing_field.id != custom_field.id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "slug"),
                            "msg": "Custom field with this slug already exists.",
                            "input": custom_field_update.slug,
                        }
                    ]
                )

        previous_slug = custom_field.slug
        for attr, value in custom_field_update.model_dump(
            exclude_unset=True, by_alias=True
        ).items():
            setattr(custom_field, attr, value)

        # Update the slug from all custom_field_data JSONB
        if previous_slug != custom_field.slug:
            for model in custom_field_data_models:
                update_statement = (
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
                await session.execute(update_statement)

        session.add(custom_field)
        return custom_field

    async def delete(
        self, session: AsyncSession, custom_field: CustomField
    ) -> CustomField:
        custom_field.set_deleted_at()
        session.add(custom_field)

        # Delete row with this custom field from all association tables
        for model in attached_custom_fields_models:
            delete_statement = delete(model).where(
                model.custom_field_id == custom_field.id
            )
            await session.execute(delete_statement)

        return custom_field

    async def get_by_organization_and_id(
        self, session: AsyncSession, id: uuid.UUID, organization_id: uuid.UUID
    ) -> CustomField | None:
        statement = select(CustomField).where(
            CustomField.deleted_at.is_(None),
            CustomField.organization_id == organization_id,
            CustomField.id == id,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_by_organization_id_and_slug(
        self, session: AsyncSession, organization_id: uuid.UUID, slug: str
    ) -> CustomField | None:
        statement = select(CustomField).where(
            CustomField.organization_id == organization_id,
            CustomField.slug == slug,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    def _get_readable_custom_field_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CustomField]]:
        statement = (
            select(CustomField)
            .where(CustomField.deleted_at.is_(None))
            .join(Organization, Organization.id == CustomField.organization_id)
            .options(contains_eager(CustomField.organization))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                CustomField.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                CustomField.organization_id == auth_subject.subject.id,
            )

        return statement


custom_field = CustomFieldService(CustomField)
