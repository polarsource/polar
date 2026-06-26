from uuid import UUID

from sqlalchemy import Select, select
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
from polar.models import BenefitGrant, LicenseKey


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

    async def is_granted_through_subscription(self, license_key: LicenseKey) -> bool:
        statement = (
            select(BenefitGrant.id)
            .where(
                BenefitGrant.benefit_id == license_key.benefit_id,
                BenefitGrant.customer_id == license_key.customer_id,
                BenefitGrant.member_id == license_key.member_id,
                BenefitGrant.subscription_id.is_not(None),
                BenefitGrant.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.first() is not None

    def get_eager_options(self) -> Options:
        return (
            joinedload(LicenseKey.customer),
            joinedload(LicenseKey.activations),
            joinedload(LicenseKey.benefit),
        )

    def get_customer_statement(
        self, auth_subject: AuthSubject[Customer | Member]
    ) -> Select[tuple[LicenseKey]]:
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
    ) -> Select[tuple[LicenseKey]]:
        statement = self.get_base_statement()
        statement = statement.where(LicenseKey.organization_id.in_(org_ids))
        return statement
