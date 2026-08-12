from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.kit.encryption import EncryptedString
from polar.merchant_migration.operation import MerchantMigrationOperationStatus
from polar.merchant_migration.repository import MerchantMigrationRepository
from polar.merchant_migration.service import (
    SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT,
    StripeSourceCredentials,
)
from polar.merchant_migration.service import merchant_migration as service
from polar.models import MerchantMigration, Organization, User
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def assert_no_migrations(
    session: AsyncSession, organization: Organization
) -> None:
    """A rejected create must leave nothing behind, not even an unusable row."""
    repository = MerchantMigrationRepository.from_session(session)
    migrations = await repository.get_all(
        repository.get_base_statement().where(
            MerchantMigration.organization_id == organization.id
        )
    )
    assert len(migrations) == 0


async def build_stripe_credentials(
    migration: MerchantMigration,
    api_key: str = "rk_test_123",
    stripe_user_id: str | None = "acct_test",
) -> StripeSourceCredentials:
    """Encrypt a pasted key the same way the service does, so a fixture migration
    decrypts back to ``api_key``."""
    encrypted = await EncryptedString.encrypt(
        api_key,
        context={**SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT, "id": str(migration.id)},
    )
    return StripeSourceCredentials(
        api_key_encrypted=encrypted.encrypted_value,
        stripe_user_id=stripe_user_id,
        livemode=api_key.startswith(("rk_live_", "sk_live_")),
    )


async def build_connected_migration(
    save_fixture: SaveFixture,
    organization: Organization,
    api_key: str = "rk_test_123",
) -> MerchantMigration:
    """A Stripe migration with source credentials already stored, in a single
    INSERT (the id is pre-generated so the encrypted key binds to it)."""
    migration = MerchantMigration(
        id=MerchantMigration.generate_id(),
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=MerchantMigrationStep.source_setup,
    )
    migration.source_credentials = dict(
        await build_stripe_credentials(migration, api_key)
    )
    await save_fixture(migration)
    return migration


async def drain_precheck(
    session: AsyncSession, migration_id: UUID
) -> MerchantMigration:
    """Run precheck batches until the operation is terminal."""
    for _ in range(1000):
        await service.process_precheck_batch(session, migration_id)
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_by_id(migration_id)
        assert migration is not None
        assert migration.operation is not None
        if migration.operation.is_terminal:
            return migration
    raise AssertionError("precheck did not finish")


async def drain_import(session: AsyncSession, migration_id: UUID) -> MerchantMigration:
    """Run import batches until the operation is terminal."""
    for _ in range(1000):
        await service.process_import_batch(session, migration_id)
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_by_id(migration_id)
        assert migration is not None
        assert migration.operation is not None
        if migration.operation.is_terminal:
            return migration
    raise AssertionError("import did not finish")


async def run_precheck(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    migration_id: UUID,
) -> MerchantMigration:
    """Start and drain precheck — the sync stand-in for old tests."""
    migration = await service.start_precheck(session, auth_subject, migration_id)
    assert migration.operation is not None
    assert migration.operation.status == MerchantMigrationOperationStatus.pending
    return await drain_precheck(session, migration_id)


async def run_import(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    migration_id: UUID,
    *,
    record_ids: Sequence[UUID] | None = None,
    exclude_record_ids: Sequence[UUID] | None = None,
) -> MerchantMigration:
    """Start and drain import — the sync stand-in for old tests."""
    migration = await service.start_import(
        session,
        auth_subject,
        migration_id,
        record_ids=record_ids,
        exclude_record_ids=exclude_record_ids,
    )
    assert migration.operation is not None
    assert migration.operation.status == MerchantMigrationOperationStatus.pending
    return await drain_import(session, migration_id)
