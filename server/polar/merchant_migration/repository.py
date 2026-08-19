from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import MerchantMigration, MerchantMigrationRecord, Subscription
from polar.models.merchant_migration_operation import (
    MerchantMigrationOperationSelection,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)

from .canonical import CanonicalRecord, serialize

type RecordCounts = dict[
    tuple[UUID, MerchantMigrationRecordType, MerchantMigrationRecordStatus], int
]

# (migration, ledger status, record type, canonical blob)
type CanonicalRow = tuple[
    UUID, MerchantMigrationRecordStatus, MerchantMigrationRecordType, dict[str, Any]
]


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

    async def refresh_for_update(self, migration: MerchantMigration) -> None:
        """Re-read under a row lock, so a background write can't overwrite what
        ops changed while it was working. Not `get_by_id(for_update=True)`: that
        takes the lock but keeps the stale attributes already in the session."""
        await self.session.refresh(migration, with_for_update=True)

    def get_ops_statement(self) -> Select[tuple[MerchantMigration]]:
        """Every migration across every organization, newest first.

        Deliberately unscoped: the backoffice watches all migrations at once and
        is gated on admin instead.
        """
        return (
            self.get_base_statement()
            .options(joinedload(MerchantMigration.organization))
            .order_by(MerchantMigration.created_at.desc())
        )

    async def get_ops_by_id(
        self, id: UUID, *, for_update: bool = False
    ) -> MerchantMigration | None:
        """One migration, unscoped the same way the ops listing is.

        ``for_update`` serializes concurrent ops actions on the same migration.
        It drops the organization join, because `FOR UPDATE` can't be applied
        across an outer join — no mutation path renders the organization.
        """
        if for_update:
            return await self.get_by_id(id, for_update=True)
        return await self.get_one_or_none(
            self.get_ops_statement().where(MerchantMigration.id == id)
        )


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

    async def count_by_type_and_status(
        self, migration_ids: Sequence[UUID]
    ) -> RecordCounts:
        """Tally the ledger for several migrations in one query, so a listing can
        show progress per row without a query each."""
        if not migration_ids:
            return {}
        statement = (
            select(
                MerchantMigrationRecord.merchant_migration_id,
                MerchantMigrationRecord.type,
                MerchantMigrationRecord.status,
                func.count().label("count"),
            )
            .where(
                MerchantMigrationRecord.merchant_migration_id.in_(migration_ids),
                MerchantMigrationRecord.deleted_at.is_(None),
            )
            .group_by(
                MerchantMigrationRecord.merchant_migration_id,
                MerchantMigrationRecord.type,
                MerchantMigrationRecord.status,
            )
        )
        result = await self.session.execute(statement)
        return {
            (migration_id, type, status): count
            for migration_id, type, status, count in result.all()
        }

    async def count_failed(self, migration_ids: Sequence[UUID]) -> dict[UUID, int]:
        """Failed rows per migration, the only tally the ops queue triages on.

        Narrower than ``count_by_type_and_status`` on purpose: the listing needs
        one number per row, not a 20-cell breakdown of a table that only grows.
        """
        if not migration_ids:
            return {}
        statement = (
            select(
                MerchantMigrationRecord.merchant_migration_id,
                func.count(),
            )
            .where(
                MerchantMigrationRecord.merchant_migration_id.in_(migration_ids),
                MerchantMigrationRecord.status == MerchantMigrationRecordStatus.failed,
                MerchantMigrationRecord.deleted_at.is_(None),
            )
            .group_by(MerchantMigrationRecord.merchant_migration_id)
        )
        result = await self.session.execute(statement)
        return {migration_id: count for migration_id, count in result.all()}

    async def _list_canonicals(
        self,
        type: MerchantMigrationRecordType,
        *scope: ColumnElement[bool],
    ) -> Sequence[CanonicalRow]:
        statement = select(
            MerchantMigrationRecord.merchant_migration_id,
            MerchantMigrationRecord.status,
            MerchantMigrationRecord.type,
            MerchantMigrationRecord.canonical,
        ).where(
            *scope,
            MerchantMigrationRecord.type == type,
            MerchantMigrationRecord.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return [
            (migration_id, status, type, canonical)
            for migration_id, status, type, canonical in result.all()
        ]

    async def list_product_canonicals(
        self, organization_ids: Sequence[UUID]
    ) -> Sequence[CanonicalRow]:
        """Products carry the prices subscriptions are charged at.

        Scoped by organization rather than migration: the ledger is keyed per
        org, so a re-run's subscriptions are priced by product rows staged under
        an earlier migration. A merchant has tens of products, so reading all of
        theirs is cheap.
        """
        if not organization_ids:
            return []
        return await self._list_canonicals(
            MerchantMigrationRecordType.product,
            MerchantMigrationRecord.organization_id.in_(organization_ids),
        )

    async def list_subscription_canonicals(
        self, migration_ids: Sequence[UUID]
    ) -> Sequence[CanonicalRow]:
        """The volume side: one row per migrated subscription, so callers should
        pass only the migrations they are about to render."""
        if not migration_ids:
            return []
        return await self._list_canonicals(
            MerchantMigrationRecordType.subscription,
            MerchantMigrationRecord.merchant_migration_id.in_(migration_ids),
        )

    async def list_by_migration_and_status(
        self,
        migration_id: UUID,
        status: MerchantMigrationRecordStatus,
        *,
        limit: int,
    ) -> Sequence[MerchantMigrationRecord]:
        statement = (
            self.get_base_statement()
            .where(
                MerchantMigrationRecord.merchant_migration_id == migration_id,
                MerchantMigrationRecord.status == status,
            )
            .order_by(
                MerchantMigrationRecord.type,
                MerchantMigrationRecord.created_at,
                MerchantMigrationRecord.id,
            )
            .limit(limit)
        )
        return await self.get_all(statement)

    def _imported_subscriptions_statement(
        self, migration_id: UUID
    ) -> Select[tuple[MerchantMigrationRecord]]:
        """Subscriptions that made it into Polar: what the card check reads.

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
        self, migration_id: UUID, *, offset: int, limit: int
    ) -> Sequence[MerchantMigrationRecord]:
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .offset(offset)
            .limit(limit)
        )
        return await self.get_all(statement)

    def _selection_filter(
        self, selection: MerchantMigrationOperationSelection | None
    ) -> list[ColumnElement[bool]]:
        """Narrow the imported subscriptions to the ones the merchant picked.

        Empty (or absent) selection means every imported subscription, matching
        the opt-out shape the import already uses.
        """
        if selection is None:
            return []
        if selection.record_ids is not None:
            return [MerchantMigrationRecord.id.in_(selection.record_ids)]
        if selection.exclude_record_ids is not None:
            return [MerchantMigrationRecord.id.not_in(selection.exclude_record_ids)]
        return []

    async def get_next_cutover_candidate(
        self,
        migration_id: UUID,
        selection: MerchantMigrationOperationSelection | None = None,
    ) -> MerchantMigrationRecord | None:
        """Claim the next subscription the cutover hasn't settled yet.

        Locked and skipping locked rows, so a second run started by an impatient
        merchant works alongside the first instead of moving the same
        subscription twice.
        """
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .where(
                MerchantMigrationRecord.cutover_status.is_(None),
                *self._selection_filter(selection),
            )
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

    async def payment_method_coverage(self, migration_id: UUID) -> set[UUID]:
        """The imported-subscription record ids whose Polar subscription already
        has a payment method to charge.

        Any linked method counts, not only cards: ACH and SEPA move with the copy
        and Polar can charge them. Used to hint which rows are ready to switch
        before the merchant picks them.
        """
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .join(
                Subscription,
                (Subscription.id == MerchantMigrationRecord.target_id)
                & Subscription.deleted_at.is_(None)
                & Subscription.payment_method_id.is_not(None),
            )
            .with_only_columns(MerchantMigrationRecord.id)
            .order_by(None)
        )
        result = await self.session.execute(statement)
        return {row[0] for row in result.all()}

    async def reset_cutover(
        self,
        migration_id: UUID,
        selection: MerchantMigrationOperationSelection | None = None,
    ) -> None:
        """Clear the settled-but-not-moved outcomes in the selection so a retry
        looks at them again. What moved stays moved."""
        statement = (
            self._imported_subscriptions_statement(migration_id)
            .where(
                MerchantMigrationRecord.cutover_status.in_(
                    (
                        MerchantMigrationCutoverStatus.skipped,
                        MerchantMigrationCutoverStatus.failed,
                    )
                ),
                *self._selection_filter(selection),
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
