"""Background operation state for merchant migration precheck and catalog import.

Persisted as JSONB on ``MerchantMigration.operation``. ``MerchantMigration.step``
names the phase; ``operation.status`` says where we are within it. There is no
separate ``kind`` — it would always duplicate ``step``.
"""

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator
from sqlalchemy import Dialect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import Schema
from polar.kit.utils import utc_now
from polar.models.merchant_migration_record import MerchantMigrationRecordType

from .errors import MerchantMigrationError

# How long an operation may sit in pending/running without progress before GET
# marks it failed. Workers bump ``last_progress_at`` on every successful batch.
STALL_THRESHOLD = timedelta(minutes=20)

PRECHECK_BATCH_SIZE = 50
IMPORT_BATCH_SIZE = 25


class MerchantMigrationOperationStatus(StrEnum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class OperationInProgress(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "A background operation is already running for this migration.",
            409,
        )


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
        description="Bumped on enqueue and each successful batch; used for stall detection.",
    )

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
    impl = JSONB
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


def new_pending_operation(
    *,
    selection: MerchantMigrationOperationSelection | None = None,
) -> MerchantMigrationOperation:
    return MerchantMigrationOperation(
        status=MerchantMigrationOperationStatus.pending,
        cursor=None,
        selection=selection,
        error=None,
        last_progress_at=utc_now(),
    )


def mark_running(
    operation: MerchantMigrationOperation,
    *,
    cursor: dict[str, Any] | None,
) -> MerchantMigrationOperation:
    return operation.model_copy(
        update={
            "status": MerchantMigrationOperationStatus.running,
            "cursor": cursor,
            "error": None,
            "last_progress_at": utc_now(),
        }
    )


def mark_done(operation: MerchantMigrationOperation) -> MerchantMigrationOperation:
    return operation.model_copy(
        update={
            "status": MerchantMigrationOperationStatus.done,
            "cursor": None,
            "error": None,
            "last_progress_at": utc_now(),
        }
    )


def mark_failed(
    operation: MerchantMigrationOperation, error: str
) -> MerchantMigrationOperation:
    return operation.model_copy(
        update={
            "status": MerchantMigrationOperationStatus.failed,
            "error": error,
            "last_progress_at": utc_now(),
        }
    )


# --- Cursor helpers (opaque dicts persisted on the operation) ---

PRECHECK_PHASES = ("products", "customers", "subscriptions")
IMPORT_TYPES = (
    MerchantMigrationRecordType.product,
    MerchantMigrationRecordType.customer,
    MerchantMigrationRecordType.subscription,
)


def precheck_cursor(*, phase: str, starting_after: str | None = None) -> dict[str, Any]:
    cursor: dict[str, Any] = {"phase": phase}
    if starting_after is not None:
        cursor["starting_after"] = starting_after
    return cursor


def import_cursor(
    *,
    record_type: MerchantMigrationRecordType,
    after_id: UUID | None = None,
) -> dict[str, Any]:
    cursor: dict[str, Any] = {"type": record_type.value}
    if after_id is not None:
        cursor["after_id"] = str(after_id)
    return cursor


def parse_import_type(cursor: dict[str, Any] | None) -> MerchantMigrationRecordType:
    if cursor is None:
        return MerchantMigrationRecordType.product
    return MerchantMigrationRecordType(cursor["type"])


def parse_import_after_id(cursor: dict[str, Any] | None) -> UUID | None:
    if cursor is None or cursor.get("after_id") is None:
        return None
    return UUID(str(cursor["after_id"]))


def next_import_type(
    record_type: MerchantMigrationRecordType,
) -> MerchantMigrationRecordType | None:
    try:
        index = IMPORT_TYPES.index(record_type)
    except ValueError:
        return None
    if index + 1 >= len(IMPORT_TYPES):
        return None
    return IMPORT_TYPES[index + 1]
