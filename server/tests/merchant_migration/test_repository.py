from datetime import UTC, datetime

import pytest

from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    serialize,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.models import (
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    Product,
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
from tests.fixtures.random_objects import create_customer, create_payment_method
from tests.merchant_migration._helpers import canonical_subscription


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
                currency="usd",
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
        assert reloaded.canonical["currency"] == "usd"

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


@pytest.mark.asyncio
class TestGetOpsStatement:
    async def test_returns_migrations_across_organizations(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await _create_migration(save_fixture, organization)
        await _create_migration(save_fixture, organization_second)
        repository = MerchantMigrationRepository.from_session(session)

        migrations = await repository.get_all(repository.get_ops_statement())

        assert {migration.organization_id for migration in migrations} == {
            organization.id,
            organization_second.id,
        }
        # The organization is eager-loaded: the ops listing reads `.name` per row.
        assert all(migration.organization is not None for migration in migrations)


@pytest.mark.asyncio
class TestGetOpsById:
    async def test_loads_the_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRepository.from_session(session)

        found = await repository.get_ops_by_id(migration.id)

        assert found is not None
        assert found.organization.id == organization.id

    async def test_for_update_skips_the_organization_join(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """`FOR UPDATE` can't cross an outer join, so the locking read drops it."""
        migration = await _create_migration(save_fixture, organization)
        repository = MerchantMigrationRepository.from_session(session)

        found = await repository.get_ops_by_id(migration.id, for_update=True)

        assert found is not None
        assert found.id == migration.id

    async def test_unknown_id_is_none(self, session: AsyncSession) -> None:
        repository = MerchantMigrationRepository.from_session(session)

        assert await repository.get_ops_by_id(MerchantMigration.generate_id()) is None


@pytest.mark.asyncio
class TestSwitchableSubscriptions:
    async def test_pending_subscription_with_imported_dependencies_is_switchable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        customer = await create_customer(
            save_fixture, organization=organization, email="ready@example.com"
        )
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=migration,
                organization=organization,
                type=MerchantMigrationRecordType.customer,
                status=MerchantMigrationRecordStatus.imported,
                source_id="cus_ready",
                target_id=customer.id,
                canonical={},
            )
        )
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=migration,
                organization=organization,
                type=MerchantMigrationRecordType.product,
                status=MerchantMigrationRecordStatus.imported,
                source_id="prod_1:month:1",
                target_id=product.id,
                canonical=serialize(
                    CanonicalProduct(
                        source_id="prod_1:month:1",
                        product_source_id="prod_1",
                        name="Product",
                        recurring_interval="month",
                        recurring_interval_count=1,
                        prices=[
                            CanonicalPrice(
                                source_id="price_ready",
                                currency="usd",
                                amount=1000,
                                pricing_scheme=CanonicalPricingScheme.fixed,
                            )
                        ],
                    )
                ),
            )
        )
        ready = MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.subscription,
            status=MerchantMigrationRecordStatus.pending,
            source_id="sub_ready",
            canonical=serialize(
                canonical_subscription(
                    source_id="sub_ready",
                    customer_source_id="cus_ready",
                    price_source_id="price_ready",
                )
            ),
        )
        unready = MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.subscription,
            status=MerchantMigrationRecordStatus.pending,
            source_id="sub_unready",
            canonical=serialize(
                canonical_subscription(
                    source_id="sub_unready",
                    customer_source_id="cus_missing",
                    price_source_id="price_ready",
                )
            ),
        )
        await save_fixture(ready)
        await save_fixture(unready)
        repository = MerchantMigrationRecordRepository.from_session(session)

        records = await repository.list_imported_subscriptions(
            migration.id, offset=0, limit=10
        )

        assert [record.id for record in records] == [ready.id]
        assert await repository.payment_method_coverage(migration.id) == set()
        await create_payment_method(save_fixture, customer, processor_id="pm_ready")
        assert await repository.payment_method_coverage(migration.id) == {ready.id}

    async def test_pending_subscription_sees_dependencies_from_earlier_migration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        earlier = await _create_migration(save_fixture, organization)
        current = await _create_migration(save_fixture, organization)
        customer = await create_customer(
            save_fixture, organization=organization, email="reused@example.com"
        )
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=earlier,
                organization=organization,
                type=MerchantMigrationRecordType.customer,
                status=MerchantMigrationRecordStatus.imported,
                source_id="cus_ready",
                target_id=customer.id,
                canonical={},
            )
        )
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=earlier,
                organization=organization,
                type=MerchantMigrationRecordType.product,
                status=MerchantMigrationRecordStatus.imported,
                source_id="prod_1:month:1",
                target_id=product.id,
                canonical=serialize(
                    CanonicalProduct(
                        source_id="prod_1:month:1",
                        product_source_id="prod_1",
                        name="Product",
                        recurring_interval="month",
                        recurring_interval_count=1,
                        prices=[
                            CanonicalPrice(
                                source_id="price_ready",
                                currency="usd",
                                amount=1000,
                                pricing_scheme=CanonicalPricingScheme.fixed,
                            )
                        ],
                    )
                ),
            )
        )
        pending = MerchantMigrationRecord(
            merchant_migration=current,
            organization=organization,
            type=MerchantMigrationRecordType.subscription,
            status=MerchantMigrationRecordStatus.pending,
            source_id="sub_ready",
            canonical=serialize(
                canonical_subscription(
                    source_id="sub_ready",
                    customer_source_id="cus_ready",
                    price_source_id="price_ready",
                )
            ),
        )
        await save_fixture(pending)
        repository = MerchantMigrationRecordRepository.from_session(session)

        records = await repository.list_imported_subscriptions(
            current.id, offset=0, limit=10
        )

        assert [record.id for record in records] == [pending.id]
        found = await repository.get_imported_customer_dependency(
            organization.id, "cus_ready"
        )
        assert found is not None
        assert found.merchant_migration_id == earlier.id
