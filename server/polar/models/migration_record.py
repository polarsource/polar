from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models.migration_job import MigrationJob
    from polar.models.organization import Organization


class MigrationRecordType(StrEnum):
    customer = "customer"
    product = "product"
    discount = "discount"
    benefit = "benefit"
    subscription = "subscription"
    order = "order"


class MigrationRecordStatus(StrEnum):
    pending = "pending"
    imported = "imported"
    skipped = "skipped"
    failed = "failed"


class MigrationRecord(RecordModel):
    """One imported thing (customer, product, subscription, …).

    Maps a ``source_id`` from the billing provider to the created Polar object
    (``target_id``). Scoped per organization, this is the idempotency layer so
    a migration can be retried safely.
    """

    __tablename__ = "migration_records"
    __table_args__ = (
        # Idempotency: one record per source object within an organization,
        # regardless of how many migration jobs were triggered.
        Index(
            "ix_migration_records_organization_type_source",
            "organization_id",
            "type",
            "source_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    migration_job_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("migration_jobs.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    type: Mapped[MigrationRecordType] = mapped_column(
        StringEnum(MigrationRecordType, length=32), nullable=False
    )

    source_id: Mapped[str] = mapped_column(String, nullable=False)

    target_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, default=None)

    status: Mapped[MigrationRecordStatus] = mapped_column(
        StringEnum(MigrationRecordStatus, length=32),
        nullable=False,
        default=MigrationRecordStatus.pending,
    )

    # The normalized in-memory representation (CanonicalRecord) snapshotted at
    # import time.
    canonical: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def migration_job(cls) -> Mapped["MigrationJob"]:
        return relationship("MigrationJob", lazy="raise")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
