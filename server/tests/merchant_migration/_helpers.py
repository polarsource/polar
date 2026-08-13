from datetime import datetime, timedelta

from polar.kit.encryption import EncryptedString
from polar.kit.utils import utc_now
from polar.merchant_migration import pan_transfer
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalPaymentMethod,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    serialize,
)
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
from polar.models import (
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    Subscription,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
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


def canonical_subscription(
    *,
    source_id: str = "sub_1",
    customer_source_id: str = "cus_1",
    price_source_id: str = "price_1",
    status: CanonicalSubscriptionStatus = CanonicalSubscriptionStatus.active,
    collection_method: CanonicalCollectionMethod = (
        CanonicalCollectionMethod.charge_automatically
    ),
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    line_item_count: int = 1,
    quantity: int = 1,
    has_discount: bool = False,
    cancel_at_period_end: bool = False,
    trial_end: datetime | None = None,
    stopped_for_migration: bool = False,
    payment_method: CanonicalPaymentMethod | None = None,
) -> CanonicalSubscription:
    """A source subscription that renews comfortably outside the safety window,
    so a test only states the field it's actually about."""
    return CanonicalSubscription(
        source_id=source_id,
        customer_source_id=customer_source_id,
        price_source_id=price_source_id,
        status=status,
        collection_method=collection_method,
        current_period_start=current_period_start or utc_now() - timedelta(days=10),
        current_period_end=current_period_end or utc_now() + timedelta(days=20),
        trialing=status == CanonicalSubscriptionStatus.trialing,
        paused_collection=status == CanonicalSubscriptionStatus.paused,
        line_item_count=line_item_count,
        quantity=quantity,
        payment_method=payment_method,
        has_discount=has_discount,
        cancel_at_period_end=cancel_at_period_end,
        trial_end=trial_end,
        stopped_for_migration=stopped_for_migration,
    )


async def stage_subscription_record(
    save_fixture: SaveFixture,
    migration: MerchantMigration,
    organization: Organization,
    subscription: Subscription,
    *,
    source_id: str = "sub_1",
    price_source_id: str = "price_1",
) -> MerchantMigrationRecord:
    """An imported subscription in the ledger, pointing at its Polar row: what
    the cutover reads."""
    record = MerchantMigrationRecord(
        merchant_migration=migration,
        organization=organization,
        type=MerchantMigrationRecordType.subscription,
        status=MerchantMigrationRecordStatus.imported,
        source_id=source_id,
        target_id=subscription.id,
        canonical=serialize(
            canonical_subscription(source_id=source_id, price_source_id=price_source_id)
        ),
    )
    await save_fixture(record)
    return record


def steps_at(key: str) -> list[PanTransferStep]:
    """A PAN copy checklist walked until ``key`` is the step to act on."""
    method = PanTransferMethod.pan_copy
    steps = pan_transfer.build(method)
    while True:
        current = pan_transfer.current(steps)
        assert current is not None, f"the checklist ran out before `{key}`"
        if current.key == key:
            return steps
        steps = pan_transfer.complete(
            method, steps, current.key, actor=_actor_for(current.owner), inputs={}
        )


def _actor_for(owner: PanStepOwner) -> PanStepActor:
    match owner:
        case PanStepOwner.merchant:
            return PanStepActor.merchant
        case PanStepOwner.polar_app:
            return PanStepActor.system
        case _:
            return PanStepActor.ops
