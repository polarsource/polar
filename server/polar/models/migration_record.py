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
    subscription = "subscription"
    order = "order"
    discount = "discount"


class MigrationRecordStatus(StrEnum):
    pending = "pending"
    imported = "imported"
    skipped = "skipped"
    failed = "failed"


class MigrationRecord(RecordModel):
    """One imported thing, mapping a source object to its Polar counterpart.

    The idempotency layer: scoped per organization by (type, source_id), so a
    migration can be retried and multiple runs can reuse already-imported
    records safely.
    """

    __tablename__ = "migration_records"
    __table_args__ = (
        Index(
            "ix_migration_records_organization_id_type_source_id",
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
    status: Mapped[MigrationRecordStatus] = mapped_column(
        StringEnum(MigrationRecordStatus, length=32),
        nullable=False,
        default=MigrationRecordStatus.pending,
    )
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    # The Polar object created or reused for this record, once imported.
    target_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True, default=None)
    # Normalized in-memory representation (CanonicalRecord) captured at import.
    canonical: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # Why a record was skipped or failed.
    error: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def migration_job(cls) -> Mapped["MigrationJob"]:
        return relationship("MigrationJob", lazy="raise")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
