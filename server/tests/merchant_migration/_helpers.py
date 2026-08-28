from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

from pytest_mock import MockerFixture

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
    PanStepTemplate,
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


_STEP_ACTORS = {
    PanStepOwner.merchant: PanStepActor.merchant,
    PanStepOwner.polar_ops: PanStepActor.ops,
    PanStepOwner.stripe: PanStepActor.ops,
    PanStepOwner.provider: PanStepActor.ops,
    PanStepOwner.polar_app: PanStepActor.system,
}


def pan_step_required_inputs(template: PanStepTemplate) -> dict[str, str]:
    return {
        key: "migreq_test" if key == "stripe_migration_request_id" else "value"
        for key in template.required_inputs
    }


def pan_steps_until(
    method: PanTransferMethod, target_key: str | None
) -> list[PanTransferStep]:
    """A checklist walked forward to ``target_key``, with everything before it
    completed by whoever owns it: what the merchant would have clicked through.
    ``None`` completes every step.
    """
    steps = pan_transfer.build(method)
    while True:
        current = pan_transfer.current(steps)
        if current is None or current.key == target_key:
            return steps
        template = pan_transfer._template(method, current.key)
        steps = pan_transfer.complete(
            method,
            steps,
            current.key,
            actor=_STEP_ACTORS[current.owner],
            inputs=pan_step_required_inputs(template),
        )


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
    anchor_day: int | None = None,
    payment_method: CanonicalPaymentMethod | None = None,
    currency: str | None = "usd",
) -> CanonicalSubscription:
    """Renews outside the safety window, so a test only states its own field."""
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
        anchor_day=anchor_day,
        currency=currency,
    )


async def stage_subscription_record(
    save_fixture: SaveFixture,
    migration: MerchantMigration,
    organization: Organization,
    subscription: Subscription,
    *,
    source_id: str = "sub_1",
    price_source_id: str = "price_1",
    currency: str | None = "usd",
) -> MerchantMigrationRecord:
    """An imported subscription in the ledger: what the cutover reads."""
    record = MerchantMigrationRecord(
        merchant_migration=migration,
        organization=organization,
        type=MerchantMigrationRecordType.subscription,
        status=MerchantMigrationRecordStatus.imported,
        source_id=source_id,
        target_id=subscription.id,
        canonical=serialize(
            canonical_subscription(
                source_id=source_id,
                price_source_id=price_source_id,
                currency=currency,
            )
        ),
    )
    await save_fixture(record)
    return record


def copied_cards(mocker: MockerFixture, *cards: Any) -> None:
    """What `list_payment_methods` finds on Polar's Stripe account."""

    async def listed(customer: str) -> AsyncIterator[Any]:
        for card in cards:
            yield card

    mocker.patch(
        "polar.merchant_migration.cards.stripe_service.list_payment_methods",
        new=listed,
    )
