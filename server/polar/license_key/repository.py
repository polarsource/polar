from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import LicenseKey, Organization, UserOrganization


class LicenseKeyRepository(
    RepositorySoftDeletionIDMixin[LicenseKey, UUID],
    RepositorySoftDeletionMixin[LicenseKey],
    RepositoryBase[LicenseKey],
):
    model = LicenseKey

    async def get_by_organization_and_key(
        self,
        organization: UUID,
        key: str,
        *,
        include_deleted: bool = False,
        options: Options = (),
    ) -> LicenseKey | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(LicenseKey.organization_id == organization, LicenseKey.key == key)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_organization_customer_and_benefit(
        self,
        id: UUID,
        organization: UUID,
        customer: UUID,
        benefit: UUID,
        *,
        include_deleted: bool = False,
        options: Options = (),
    ) -> LicenseKey | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(
                LicenseKey.id == id,
                LicenseKey.organization_id == organization,
                LicenseKey.customer_id == customer,
                LicenseKey.benefit_id == benefit,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_readable_by_key(
        self,
        key: str,
        organization_id: UUID,
        auth_subject: AuthSubject[User | Organization],
        *,
        options: Options = (),
    ) -> LicenseKey | None:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(
                LicenseKey.key == key,
                LicenseKey.organization_id == organization_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (
            joinedload(LicenseKey.customer),
            joinedload(LicenseKey.activations),
            joinedload(LicenseKey.benefit),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[LicenseKey]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                LicenseKey.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                LicenseKey.organization_id == auth_subject.subject.id,
            )

        return statement
