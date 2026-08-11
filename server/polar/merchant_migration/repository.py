from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import MerchantMigration, MerchantMigrationRecord, Subscription
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)

from .canonical import CanonicalRecord, serialize


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


class MerchantMigrationRecordRepository(
    RepositorySoftDeletionIDMixin[MerchantMigrationRecord, UUID],
    RepositorySoftDeletionMixin[MerchantMigrationRecord],
    RepositoryBase[MerchantMigrationRecord],
):
    model = MerchantMigrationRecord

    async def get_by_source(
        self,
        *,
        organization_id: UUID,
        type: MerchantMigrationRecordType,
        source_id: str,
    ) -> MerchantMigrationRecord | None:
        statement = self.get_base_statement().where(
            MerchantMigrationRecord.organization_id == organization_id,
            MerchantMigrationRecord.type == type,
            MerchantMigrationRecord.source_id == source_id,
        )
        return await self.get_one_or_none(statement)

    async def list_by_migration(
        self, migration_id: UUID
    ) -> Sequence[MerchantMigrationRecord]:
        # Stable order so in-memory pagination stays consistent as import updates
        # record statuses (which would otherwise reshuffle the scan order).
        statement = (
            self.get_base_statement()
            .where(MerchantMigrationRecord.merchant_migration_id == migration_id)
            .order_by(
                MerchantMigrationRecord.created_at,
                MerchantMigrationRecord.id,
            )
        )
        return await self.get_all(statement)

    def _imported_subscriptions_statement(
        self, migration_id: UUID
    ) -> Select[tuple[MerchantMigrationRecord]]:
        """The rows the cutover works on: subscriptions that made it into Polar.

        Ordered so a batched pass and a chained one see the same sequence.
        """
        return (
            self.get_base_statement()
            .where(
                MerchantMigrationRecord.merchant_migration_id == migration_id,
                MerchantMigrationRecord.type
                == MerchantMigrationRecordType.subscription,
                MerchantMigrationRecord.status
                == MerchantMigrationRecordStatus.imported,
            )
            .order_by(
                MerchantMigrationRecord.created_at,
                MerchantMigrationRecord.id,
            )
        )

    async def list_imported_subscriptions(
        self, migration_id: UUID, *, offset: int = 0, limit: int | None = None
    ) -> Sequence[MerchantMigrationRecord]:
        statement = self._imported_subscriptions_statement(migration_id).offset(offset)
        if limit is not None:
            statement = statement.limit(limit)
        return await self.get_all(statement)

    async def get_next_cutover_candidate(
        self, migration_id: UUID
    ) -> MerchantMigrationRecord | None:
        """Claim the next subscription the cutover hasn't settled yet.

        Locked and skipping locked rows, so a second run started by an impatient
        merchant works alongside the first instead of moving the same
        subscription twice.
        """
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .where(MerchantMigrationRecord.cutover_status.is_(None))
            .limit(1)
            .with_for_update(of=MerchantMigrationRecord, skip_locked=True)
        )
        return await self.get_one_or_none(statement)

    async def count_cutover_statuses(
        self, migration_id: UUID
    ) -> dict[MerchantMigrationCutoverStatus | None, int]:
        """How the cutover has settled the imported subscriptions so far, with
        ``None`` counting the ones it hasn't reached."""
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .with_only_columns(
                MerchantMigrationRecord.cutover_status,
                func.count(MerchantMigrationRecord.id),
            )
            .order_by(None)
            .group_by(MerchantMigrationRecord.cutover_status)
        )
        result = await self.session.execute(statement)
        return {status: count for status, count in result.all()}

    async def count_linked_cards(self, migration_id: UUID) -> tuple[int, int]:
        """``(with a card, total)`` over the imported subscriptions: what the
        card check reports back to the merchant."""
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .join(
                Subscription,
                (Subscription.id == MerchantMigrationRecord.target_id)
                & Subscription.deleted_at.is_(None),
            )
            .with_only_columns(
                func.count(Subscription.payment_method_id),
                func.count(Subscription.id),
            )
            .order_by(None)
        )
        linked, total = (await self.session.execute(statement)).one()
        return linked, total

    async def reset_cutover(self, migration_id: UUID) -> None:
        """Clear the settled-but-not-moved outcomes so a retry looks at them
        again. What moved stays moved."""
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .where(
                MerchantMigrationRecord.cutover_status.in_(
                    (
                        MerchantMigrationCutoverStatus.skipped,
                        MerchantMigrationCutoverStatus.failed,
                    )
                )
            )
            .order_by(None)
        )
        for record in await self.get_all(statement):
            await self.update(
                record, update_dict={"cutover_status": None, "cutover_error": None}
            )

    async def upsert(
        self,
        merchant_migration: MerchantMigration,
        organization: Organization,
        record: CanonicalRecord,
    ) -> MerchantMigrationRecord:
        """Idempotently stage a record, keyed per org by (type, source_id). A
        re-run refreshes a still-pending row; imported/skipped/failed rows are
        left as-is so a prior run's results aren't re-imported."""
        existing = await self.get_by_source(
            organization_id=organization.id,
            type=record.type,
            source_id=record.source_id,
        )
        canonical = serialize(record)
        if existing is not None:
            if existing.status == MerchantMigrationRecordStatus.pending:
                return await self.update(
                    existing,
                    update_dict={
                        "canonical": canonical,
                        "merchant_migration_id": merchant_migration.id,
                    },
                    flush=True,
                )
            return existing
        return await self.create(
            MerchantMigrationRecord(
                merchant_migration=merchant_migration,
                organization=organization,
                type=record.type,
                source_id=record.source_id,
                canonical=canonical,
            ),
            flush=True,
        )
