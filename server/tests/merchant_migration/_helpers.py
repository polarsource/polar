from polar.kit.encryption import EncryptedString
from polar.merchant_migration.service import (
    SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT,
    StripeSourceCredentials,
)
from polar.models import MerchantMigration, Organization
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from tests.fixtures.database import SaveFixture


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
