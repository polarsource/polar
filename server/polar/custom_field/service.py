import uuid
from collections.abc import Sequence

from polar.auth.models import AuthSubject, Organization, User
from polar.authz.service import get_accessible_org_ids
from polar.custom_field.sorting import CustomFieldSortProperty
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.models import CustomField
from polar.models.custom_field import CustomFieldType
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import CustomFieldRepository
from .schemas import CustomFieldCreate, CustomFieldUpdate


class CustomFieldService:
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
        repository = CustomFieldRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_by_org_ids_statement(org_ids)
        statement = repository.apply_query_filter(
            statement,
            organization_id=organization_id,
            query=query,
            type=type,
        )
        statement = repository.apply_sorting(statement, sorting)
        return await paginate(session, statement, pagination=pagination)

    async def create(
        self,
        session: AsyncSession,
        custom_field_create: CustomFieldCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CustomField:
        organization = await get_payload_organization(
            session, auth_subject, custom_field_create
        )

        repository = CustomFieldRepository.from_session(session)
        existing_field = await repository.get_by_organization_id_and_slug(
            organization.id, custom_field_create.slug
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
        return await repository.create(custom_field)

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

        repository = CustomFieldRepository.from_session(session)

        if (
            custom_field_update.slug is not None
            and custom_field.slug != custom_field_update.slug
        ):
            existing_field = await repository.get_by_organization_id_and_slug(
                custom_field.organization_id, custom_field_update.slug
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
        update_dict = custom_field_update.model_dump(exclude_unset=True, by_alias=True)
        custom_field = await repository.update(custom_field, update_dict=update_dict)

        if previous_slug != custom_field.slug:
            await repository.rename_slug_in_attached_data(custom_field, previous_slug)

        return custom_field

    async def delete(
        self, session: AsyncSession, custom_field: CustomField
    ) -> CustomField:
        repository = CustomFieldRepository.from_session(session)
        custom_field = await repository.soft_delete(custom_field)
        await repository.detach_from_all(custom_field.id)
        return custom_field

    async def get_by_organization_and_id(
        self, session: AsyncSession, id: uuid.UUID, organization_id: uuid.UUID
    ) -> CustomField | None:
        repository = CustomFieldRepository.from_session(session)
        statement = repository.get_base_statement().where(
            CustomField.organization_id == organization_id,
            CustomField.id == id,
        )
        return await repository.get_one_or_none(statement)


custom_field = CustomFieldService()
