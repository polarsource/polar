from polar.kit.encryption import EncryptedString
from polar.merchant_migration import pan_transfer
from polar.merchant_migration.pan_transfer import (
    PanStepActor,
    PanStepOwner,
    PanTransferMethod,
    PanTransferStep,
)
from polar.merchant_migration.repository import MerchantMigrationRepository
from polar.merchant_migration.service import (
    SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT,
    StripeSourceCredentials,
)
from polar.models import MerchantMigration, Organization
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


_STEP_ACTORS = {
    PanStepOwner.merchant: PanStepActor.merchant,
    PanStepOwner.polar_ops: PanStepActor.ops,
    PanStepOwner.stripe: PanStepActor.ops,
    PanStepOwner.provider: PanStepActor.ops,
    PanStepOwner.polar_app: PanStepActor.system,
}


def pan_steps_until(
    method: PanTransferMethod, target_key: str
) -> list[PanTransferStep]:
    """A checklist walked forward to ``target_key``, with everything before it
    completed by whoever owns it: what the merchant would have clicked through.
    """
    steps = pan_transfer.build(method)
    while True:
        current = pan_transfer.current(steps)
        if current is None or current.key == target_key:
            return steps
        steps = pan_transfer.complete(
            method, steps, current.key, actor=_STEP_ACTORS[current.owner], inputs={}
        )
