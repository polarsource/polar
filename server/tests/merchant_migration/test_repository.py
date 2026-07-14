from datetime import UTC, datetime

import pytest

from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.models import MerchantMigration, Organization
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


async def _create_migration(
    save_fixture: SaveFixture, organization: Organization
) -> MerchantMigration:
    migration = MerchantMigration(
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=MerchantMigrationStep.source_setup,
    )
    await save_fixture(migration)
    return migration


@pytest.mark.asyncio
class TestUpsert:
    async def test_creates_pending_record_with_canonical(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRecordRepository.from_session(session)

        record = await repository.upsert(
            migration,
            organization,
            CanonicalCustomer(
                source_id="cus_1", email="a@example.com", name="A", country="US"
            ),
        )

        assert record.organization_id == organization.id
        assert record.merchant_migration_id == migration.id
        assert record.type == MerchantMigrationRecordType.customer
        assert record.source_id == "cus_1"
        assert record.status == MerchantMigrationRecordStatus.pending
        assert record.canonical["email"] == "a@example.com"
        assert record.canonical["country"] == "US"

    async def test_stores_subscription_datetimes_through_jsonb(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRecordRepository.from_session(session)

        record = await repository.upsert(
            migration,
            organization,
            CanonicalSubscription(
                source_id="sub_1",
                customer_source_id="cus_1",
                price_source_id="price_1",
                status=CanonicalSubscriptionStatus.active,
                collection_method=CanonicalCollectionMethod.charge_automatically,
                current_period_start=datetime(2026, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2026, 2, 1, tzinfo=UTC),
                trialing=False,
                paused_collection=False,
                line_item_count=1,
                quantity=1,
                payment_method=CanonicalPaymentMethod(
                    source_id="pm_1", type=CanonicalPaymentMethodType.card
                ),
            ),
        )
        await session.flush()
        session.expunge(record)

        reloaded = await repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert reloaded is not None
        # datetimes round-trip through JSONB as ISO strings
        assert reloaded.canonical["current_period_start"] == "2026-01-01T00:00:00+00:00"
        assert reloaded.canonical["payment_method"]["type"] == "card"

    async def test_is_idempotent_per_source(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRecordRepository.from_session(session)
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name="A", country="US"
        )

        first = await repository.upsert(migration, organization, customer)
        second = await repository.upsert(
            migration,
            organization,
            CanonicalCustomer(
                source_id="cus_1", email="new@example.com", name="A", country="US"
            ),
        )

        assert first.id == second.id
        # a still-pending record gets its snapshot refreshed
        assert second.canonical["email"] == "new@example.com"

        all_records = await repository.get_all(repository.get_base_statement())
        assert len(all_records) == 1

    async def test_leaves_already_imported_record_untouched(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRecordRepository.from_session(session)
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name="A", country="US"
        )
        record = await repository.upsert(migration, organization, customer)
        await repository.update(
            record,
            update_dict={"status": MerchantMigrationRecordStatus.imported},
        )

        result = await repository.upsert(
            migration,
            organization,
            CanonicalCustomer(
                source_id="cus_1", email="new@example.com", name="A", country="US"
            ),
        )

        assert result.status == MerchantMigrationRecordStatus.imported
        # the imported snapshot is preserved, not overwritten by a re-run
        assert result.canonical["email"] == "a@example.com"

    async def test_repoints_pending_record_to_the_current_migration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        first_migration = await _create_migration(save_fixture, organization)
        second_migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRecordRepository.from_session(session)
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name="A", country="US"
        )

        await repository.upsert(first_migration, organization, customer)
        reused = await repository.upsert(second_migration, organization, customer)

        # a second migration reusing a still-pending record takes ownership,
        # rather than leaving it linked to the abandoned first migration
        assert reused.merchant_migration_id == second_migration.id
        all_records = await repository.get_all(repository.get_base_statement())
        assert len(all_records) == 1
