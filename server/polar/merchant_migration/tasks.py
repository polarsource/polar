from uuid import UUID

from dramatiq import Retry

from polar.exceptions import PolarTaskError
from polar.worker import (
    AsyncSessionMaker,
    TaskPriority,
    actor,
    can_retry,
)

from .service import merchant_migration as merchant_migration_service

_SAFE_FAILURE = "The background operation failed. You can retry."


class MerchantMigrationTaskError(PolarTaskError): ...


class MerchantMigrationDoesNotExist(MerchantMigrationTaskError):
    def __init__(self, migration_id: UUID) -> None:
        self.migration_id = migration_id
        super().__init__(
            f"The merchant migration with id {migration_id} does not exist."
        )


@actor(actor_name="merchant_migration.precheck", priority=TaskPriority.LOW)
async def merchant_migration_precheck(migration_id: UUID) -> None:
    try:
        async with AsyncSessionMaker() as session:
            await merchant_migration_service.process_precheck_batch(
                session, migration_id
            )
    except Exception as e:
        if can_retry():
            raise Retry() from e
        async with AsyncSessionMaker() as session:
            await merchant_migration_service.fail_operation(
                session, migration_id, _SAFE_FAILURE
            )
        raise


@actor(actor_name="merchant_migration.import", priority=TaskPriority.LOW)
async def merchant_migration_import(migration_id: UUID) -> None:
    try:
        async with AsyncSessionMaker() as session:
            await merchant_migration_service.process_import_batch(session, migration_id)
    except Exception as e:
        if can_retry():
            raise Retry() from e
        async with AsyncSessionMaker() as session:
            await merchant_migration_service.fail_operation(
                session, migration_id, _SAFE_FAILURE
            )
        raise
