from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import MerchantMigration
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)


class MerchantMigrationRepository(
    RepositorySoftDeletionIDMixin[MerchantMigration, UUID],
    RepositorySoftDeletionMixin[MerchantMigration],
    RepositoryBase[MerchantMigration],
):
    model = MerchantMigration

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[MerchantMigration]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                MerchantMigration.organization_id.in_(
                    select_accessible_org_ids(auth_subject)
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                MerchantMigration.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_ongoing_by_source(
        self,
        organization_id: UUID,
        source_platform: MerchantMigrationSourcePlatform,
    ) -> MerchantMigration | None:
        statement = (
            self.get_base_statement()
            .where(
                MerchantMigration.organization_id == organization_id,
                MerchantMigration.source_platform == source_platform,
                MerchantMigration.step != MerchantMigrationStep.completed,
            )
            .order_by(MerchantMigration.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)
