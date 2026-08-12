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
from polar.models import MerchantMigration, MerchantMigrationRecord
from polar.models.merchant_migration_record import (
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

    async def list_pending_batch(
        self,
        migration_id: UUID,
        record_type: MerchantMigrationRecordType,
        *,
        limit: int,
        after_id: UUID | None = None,
        record_ids: Sequence[UUID] | None = None,
        exclude_record_ids: Sequence[UUID] | None = None,
    ) -> Sequence[MerchantMigrationRecord]:
        """Next pending rows for one import type, filtered by selection + cursor.

        Selection is applied in SQL so an exclude-one catalog never expands into
        a million writes. Ordered by id so ``after_id`` resumes stably.
        """
        statement = (
            self.get_base_statement()
            .where(
                MerchantMigrationRecord.merchant_migration_id == migration_id,
                MerchantMigrationRecord.type == record_type,
                MerchantMigrationRecord.status == MerchantMigrationRecordStatus.pending,
            )
            .order_by(MerchantMigrationRecord.id)
            .limit(limit)
        )
        if after_id is not None:
            statement = statement.where(MerchantMigrationRecord.id > after_id)
        if record_ids is not None:
            statement = statement.where(MerchantMigrationRecord.id.in_(record_ids))
        elif exclude_record_ids:
            statement = statement.where(
                MerchantMigrationRecord.id.not_in(exclude_record_ids)
            )
        return await self.get_all(statement)

    async def list_by_migration_and_types(
        self,
        migration_id: UUID,
        types: Sequence[MerchantMigrationRecordType],
    ) -> Sequence[MerchantMigrationRecord]:
        statement = (
            self.get_base_statement()
            .where(
                MerchantMigrationRecord.merchant_migration_id == migration_id,
                MerchantMigrationRecord.type.in_(types),
            )
            .order_by(
                MerchantMigrationRecord.type,
                MerchantMigrationRecord.created_at,
                MerchantMigrationRecord.id,
            )
        )
        return await self.get_all(statement)

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
