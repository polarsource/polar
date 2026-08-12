"""Background operation helpers for merchant migration precheck and import.

The typed JSONB record lives in ``polar.models.merchant_migration_operation`` so
the column can land in a migration-only PR. This module re-exports those types
and owns worker-facing helpers (mark_*, cursors, batch sizes, OperationInProgress).
"""

from typing import Any
from uuid import UUID

from polar.kit.utils import utc_now
from polar.models.merchant_migration_operation import (
    STALL_THRESHOLD as STALL_THRESHOLD,
)
from polar.models.merchant_migration_operation import (
    MerchantMigrationOperation,
    MerchantMigrationOperationSelection,
    MerchantMigrationOperationStatus,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordType

from .errors import MerchantMigrationError

PRECHECK_BATCH_SIZE = 50
IMPORT_BATCH_SIZE = 25


class OperationInProgress(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "A background operation is already running for this migration.",
            409,
        )


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
