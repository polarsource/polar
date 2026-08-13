from datetime import UTC, datetime, timedelta

from sqlalchemy.dialects.postgresql import JSONB, dialect as postgresql_dialect

from polar.kit.utils import utc_now
from polar.models.merchant_migration_operation import (
    STALL_THRESHOLD,
    MerchantMigrationOperation,
    MerchantMigrationOperationStatus,
    MerchantMigrationOperationType,
)


class TestMerchantMigrationOperation:
    def test_is_stalled_accepts_naive_last_progress_at(self) -> None:
        operation = MerchantMigrationOperation.model_validate(
            {
                "status": "pending",
                "last_progress_at": "2020-01-01T00:00:00",
            }
        )
        assert operation.last_progress_at is not None
        assert operation.last_progress_at.tzinfo is not None
        assert operation.is_stalled() is True

    def test_is_stalled_with_aware_timestamp(self) -> None:
        operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now() - STALL_THRESHOLD - timedelta(seconds=1),
        )
        assert operation.is_stalled() is True

        fresh = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now(),
        )
        assert fresh.is_stalled() is False

    def test_naive_datetime_instance_is_coerced_to_utc(self) -> None:
        operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.pending,
            last_progress_at=datetime(2020, 1, 1, 12, 0, 0),
        )
        assert operation.last_progress_at == datetime(2020, 1, 1, 12, 0, 0, tzinfo=UTC)


class TestMerchantMigrationOperationType:
    def test_none_binds_as_sql_null_not_json_null(self) -> None:
        column_type = MerchantMigrationOperationType()
        assert isinstance(column_type.impl, JSONB)
        assert column_type.impl.none_as_null is True

        dialect = postgresql_dialect()
        bind = column_type.bind_processor(dialect)
        assert bind is not None
        assert bind(None) is None

        result = column_type.result_processor(dialect, None)
        assert result is not None
        assert result(None) is None
