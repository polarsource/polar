from uuid import UUID

from sqlalchemy import Select, or_, update
from sqlalchemy.orm import joinedload

from polar.auth.models import (
    AuthSubject,
    Customer,
    Member,
    is_member,
)
from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import LicenseKey
from polar.models.license_key import LicenseKeyStatus


class LicenseKeyRepository(
    RepositorySoftDeletionIDMixin[LicenseKey, UUID],
    RepositorySoftDeletionMixin[LicenseKey],
    RepositoryBase[LicenseKey],
):
    model = LicenseKey

    async def record_validation(self, license_key: LicenseKey) -> bool:
        now = utc_now()
        statement = (
            update(LicenseKey)
            .where(
                LicenseKey.id == license_key.id,
                LicenseKey.status == LicenseKeyStatus.granted,
                or_(LicenseKey.expires_at.is_(None), LicenseKey.expires_at > now),
            )
            .values(validations=LicenseKey.validations + 1, last_validated_at=now)
            .returning(LicenseKey.id)
            .execution_options(synchronize_session=False)
        )
        result = await self.session.execute(statement)
        if result.scalar_one_or_none() is None:
            return False
        await self.session.refresh(
            license_key,
            attribute_names=["validations", "last_validated_at", "modified_at"],
        )
        return True

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
        org_ids: set[AccessibleOrganizationID],
        *,
        options: Options = (),
    ) -> LicenseKey | None:
        statement = (
            self.get_statement_by_org_ids(org_ids)
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
            joinedload(LicenseKey.member),
            joinedload(LicenseKey.activations),
            joinedload(LicenseKey.benefit),
        )

    def get_customer_statement(
        self, auth_subject: AuthSubject[Customer | Member]
    ) -> Select[LicenseKey]:
        statement = self.get_base_statement()

        if is_member(auth_subject):
            statement = statement.where(
                LicenseKey.member_id == auth_subject.subject.id,
            )
        else:
            statement = statement.where(
                LicenseKey.customer_id == auth_subject.subject.id,
            )

        return statement

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[LicenseKey]:
        statement = self.get_base_statement()
        statement = statement.where(LicenseKey.organization_id.in_(org_ids))
        return statement
