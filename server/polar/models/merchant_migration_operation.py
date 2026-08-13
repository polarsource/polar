"""Typed JSONB shape for ``MerchantMigration.operation``.

Background precheck/import progress: status, opaque cursor, optional import
selection, error, and last_progress_at. Kept under ``polar.models`` so the
column can land in a migration-only PR (isolation check allows models +
migrations only). Worker helpers that mutate this live in
``polar.merchant_migration.operation``.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator
from sqlalchemy import Dialect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import Schema
from polar.kit.utils import utc_now

# How long an operation may sit in pending/running without progress before GET
# marks it failed. Workers bump ``last_progress_at`` on every successful batch.
STALL_THRESHOLD = timedelta(minutes=20)


class MerchantMigrationOperationStatus(StrEnum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class MerchantMigrationOperationSelection(Schema):
    """Compact import selection. Opt-in (``record_ids``) or opt-out
    (``exclude_record_ids``); never both. Workers filter batch queries with this
    rather than marking every ledger row up front."""

    record_ids: list[UUID] | None = Field(
        default=None,
        description="Import only these ledger record ids.",
    )
    exclude_record_ids: list[UUID] | None = Field(
        default=None,
        description="Import every pending importable record except these.",
    )

    @model_validator(mode="after")
    def _one_mode(self) -> "MerchantMigrationOperationSelection":
        if self.record_ids is not None and self.exclude_record_ids is not None:
            raise ValueError("Use record_ids or exclude_record_ids, not both.")
        return self


class MerchantMigrationOperation(Schema):
    """In-flight or finished background work for the current ``step``."""

    status: MerchantMigrationOperationStatus = Field(
        description="pending → running → done, or failed."
    )
    cursor: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Opaque resume point for the batch chain. Shape depends on the step "
            "(extract phase + Stripe page cursor, or import type + last record id)."
        ),
    )
    selection: MerchantMigrationOperationSelection | None = Field(
        default=None,
        description="Import only: the compact selection from the start request.",
    )
    error: str | None = Field(
        default=None,
        description="Safe failure message when status is failed.",
    )
    last_progress_at: datetime | None = Field(
        default=None,
        description=(
            "Bumped on enqueue and each successful batch; used for stall detection."
        ),
    )

    @field_validator("last_progress_at", mode="after")
    @classmethod
    def _aware_last_progress_at(cls, value: datetime | None) -> datetime | None:
        # JSONB may hold a no-offset ISO string; treat it as UTC so stall math
        # against utc_now() never mixes naïve and aware datetimes.
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

    @property
    def is_active(self) -> bool:
        return self.status in (
            MerchantMigrationOperationStatus.pending,
            MerchantMigrationOperationStatus.running,
        )

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            MerchantMigrationOperationStatus.done,
            MerchantMigrationOperationStatus.failed,
        )

    def is_stalled(self, *, now: datetime | None = None) -> bool:
        if not self.is_active or self.last_progress_at is None:
            return False
        return (now or utc_now()) - self.last_progress_at >= STALL_THRESHOLD


class MerchantMigrationOperationType(TypeDecorator[Any]):
    # none_as_null: Python None → SQL NULL (not JSON 'null'), so IS NULL matches
    # the documented null-until-started state.
    impl = JSONB(none_as_null=True)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        if isinstance(value, MerchantMigrationOperation):
            return value.model_dump(mode="json")
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        return MerchantMigrationOperation.model_validate(value)
