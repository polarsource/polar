from collections.abc import AsyncIterator

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.kit import encryption
from polar.kit.encryption import LocalKeyProvider
from polar.kit.pagination import PaginationParams
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.merchant_migration.schemas import (
    MerchantMigrationCreate,
    PrecheckEntity,
    PrecheckRecordStatus,
)
from polar.merchant_migration.service import (
    CatalogImportNotReady,
    InvalidSourceCredentials,
    MissingStripeScopes,
    SourceKeyModeMismatch,
    SourceNotConnected,
    SourceVerificationUnavailable,
    UnsupportedMigrationSource,
)
from polar.merchant_migration.service import merchant_migration as service
from polar.models import (
    Customer,
    MerchantMigration,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.merchant_migration._helpers import build_connected_migration


class _FakeAdapter:
    def __init__(
        self,
        records: list[CanonicalRecord] | None = None,
        *,
        missing_scopes: list[str] | None = None,
        verify_error: Exception | None = None,
        account_id: str | None = "acct_test",
    ) -> None:
        self._records = records or []
        self._missing_scopes = missing_scopes or []
        self._verify_error = verify_error
        self._account_id = account_id

    async def verify_scopes(self) -> list[str]:
        if self._verify_error is not None:
            raise self._verify_error
        return self._missing_scopes

    async def get_account_id(self) -> str | None:
        return self._account_id

    async def extract(self) -> AsyncIterator[CanonicalRecord]:
        for record in self._records:
            yield record

    async def get_source_account(self) -> CanonicalAccount:
        return CanonicalAccount(country="US", is_connect_platform=False)


async def _enable_feature(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "merchant_migration_enabled": True,
    }
    await save_fixture(organization)


def _create_schema(organization: Organization) -> MerchantMigrationCreate:
    return MerchantMigrationCreate(
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        api_key="rk_test_123",
    )


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_validates_key_stores_it_and_creates(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        stripe_adapter = mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(),
        )

        migration = await service.create(
            session, auth_subject, _create_schema(organization)
        )

        stripe_adapter.assert_called_once_with("rk_test_123")
        assert migration.step == MerchantMigrationStep.source_setup
        assert migration.source_connected is True
        credentials = migration.source_credentials
        assert credentials["stripe_user_id"] == "acct_test"
        assert credentials["livemode"] is False
        assert credentials["api_key_encrypted"].startswith("v1.")
        assert await service._decrypt_stripe_api_key(migration) == "rk_test_123"

    @pytest.mark.auth
    async def test_missing_scopes_raises_and_persists_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(
                missing_scopes=["Payment methods", "Subscriptions (write)"]
            ),
        )

        with pytest.raises(MissingStripeScopes) as exc_info:
            await service.create(session, auth_subject, _create_schema(organization))

        assert exc_info.value.missing == ["Payment methods", "Subscriptions (write)"]
        repository = MerchantMigrationRepository.from_session(session)
        migrations = await repository.get_all(
            repository.get_base_statement().where(
                MerchantMigration.organization_id == organization.id
            )
        )
        assert len(migrations) == 0

    @pytest.mark.auth
    async def test_invalid_key_raises(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(
                verify_error=stripe_lib.AuthenticationError("bad key")
            ),
        )

        with pytest.raises(InvalidSourceCredentials):
            await service.create(session, auth_subject, _create_schema(organization))

    @pytest.mark.auth
    async def test_transient_stripe_error_fails_closed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(
                verify_error=stripe_lib.RateLimitError("rate limited")
            ),
        )

        # A non-permission Stripe failure must not create a migration.
        with pytest.raises(SourceVerificationUnavailable):
            await service.create(session, auth_subject, _create_schema(organization))

        repository = MerchantMigrationRepository.from_session(session)
        migrations = await repository.get_all(
            repository.get_base_statement().where(
                MerchantMigration.organization_id == organization.id
            )
        )
        assert len(migrations) == 0

    @pytest.mark.auth
    async def test_sandbox_rejects_a_live_key(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # The test environment is not production, so a live-mode key is rejected
        # before Stripe is ever contacted.
        await _enable_feature(save_fixture, organization)
        with pytest.raises(SourceKeyModeMismatch):
            await service.create(
                session,
                auth_subject,
                MerchantMigrationCreate(
                    organization_id=organization.id,
                    source_platform=MerchantMigrationSourcePlatform.stripe,
                    api_key="rk_live_123",
                ),
            )

    @pytest.mark.auth
    async def test_production_requires_a_live_key(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        mocker.patch.object(settings, "is_production", return_value=True)
        # `get_key_provider` is cached, so faking production would otherwise reach
        # for KMS whenever this test happens to be the first caller in the process.
        mocker.patch.object(
            encryption,
            "get_key_provider",
            return_value=LocalKeyProvider(settings.ENCRYPTION_LOCAL_KEY),
        )

        # A test-mode key is rejected in production...
        with pytest.raises(SourceKeyModeMismatch):
            await service.create(session, auth_subject, _create_schema(organization))

        # ...and a live key is accepted, stored as livemode.
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(),
        )
        migration = await service.create(
            session,
            auth_subject,
            MerchantMigrationCreate(
                organization_id=organization.id,
                source_platform=MerchantMigrationSourcePlatform.stripe,
                api_key="rk_live_123",
            ),
        )
        assert migration.source_credentials["livemode"] is True


@pytest.mark.asyncio
class TestRunPrecheck:
    @pytest.mark.auth
    async def test_extracts_with_stored_key_and_advances_step(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = _FakeAdapter(
            [
                CanonicalProduct(
                    source_id="prod_1:month:1",
                    product_source_id="prod_1",
                    name="Pro",
                    recurring_interval="month",
                    recurring_interval_count=1,
                    prices=[
                        CanonicalPrice(
                            source_id="price_1",
                            currency="usd",
                            amount=1000,
                            pricing_scheme=CanonicalPricingScheme.fixed,
                        )
                    ],
                )
            ]
        )
        stripe_adapter = mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        report = await service.run_precheck(session, auth_subject, migration.id)

        assert report.can_start is True
        # the adapter is built from the decrypted, pasted key
        stripe_adapter.assert_called_once_with("rk_test_123")

        repository = MerchantMigrationRepository.from_session(session)
        updated = await repository.get_by_id(migration.id)
        assert updated is not None
        assert updated.step == MerchantMigrationStep.pre_check

        # the extracted canonical records are staged in the ledger
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        records = await record_repository.get_all(
            record_repository.get_base_statement()
        )
        assert len(records) == 1
        assert records[0].source_id == "prod_1:month:1"
        assert records[0].merchant_migration_id == migration.id
        assert records[0].canonical["name"] == "Pro"

    @pytest.mark.auth
    async def test_warns_when_a_polar_product_already_exists(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        existing = Product(
            organization=organization,
            name="Pro",
            recurring_interval="month",
            recurring_interval_count=1,
            prices=[ProductPriceFixed(price_amount=1000, price_currency="usd")],
            all_prices=[ProductPriceFixed(price_amount=1000, price_currency="usd")],
            product_benefits=[],
            product_medias=[],
            attached_custom_fields=[],
        )
        await save_fixture(existing)

        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_catalog()),
        )

        report = await service.run_precheck(session, auth_subject, migration.id)

        codes = {issue.code for issue in report.issues}
        assert "product_exists_in_polar" in codes

    @pytest.mark.auth
    async def test_source_not_connected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = MerchantMigration(
            organization_id=organization.id,
            source_platform=MerchantMigrationSourcePlatform.stripe,
            step=MerchantMigrationStep.source_setup,
        )
        await save_fixture(migration)

        with pytest.raises(SourceNotConnected):
            await service.run_precheck(session, auth_subject, migration.id)

    @pytest.mark.auth
    async def test_unsupported_source(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = MerchantMigration(
            organization_id=organization.id,
            source_platform=MerchantMigrationSourcePlatform.paddle,
            step=MerchantMigrationStep.source_setup,
        )
        await save_fixture(migration)

        with pytest.raises(UnsupportedMigrationSource):
            await service.run_precheck(session, auth_subject, migration.id)


def _catalog() -> list[CanonicalRecord]:
    return [
        CanonicalProduct(
            source_id="prod_1:month:1",
            product_source_id="prod_1",
            name="Pro",
            recurring_interval="month",
            recurring_interval_count=1,
            prices=[
                CanonicalPrice(
                    source_id="price_1",
                    currency="usd",
                    amount=1000,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                )
            ],
        ),
        CanonicalProduct(
            source_id="prod_2:one_time",
            product_source_id="prod_2",
            name="Legacy",
            recurring_interval=None,
            recurring_interval_count=1,
            prices=[
                CanonicalPrice(
                    source_id="price_2",
                    currency="usd",
                    amount=500,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                )
            ],
        ),
    ]


@pytest.mark.asyncio
class TestListRecords:
    @pytest.mark.auth
    async def test_classifies_and_paginates(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_catalog()),
        )

        await service.run_precheck(session, auth_subject, migration.id)
        items, count = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.products,
            status=None,
            pagination=PaginationParams(page=1, limit=1),
        )

        assert count == 2
        assert len(items) == 1

    @pytest.mark.auth
    async def test_status_filter(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_catalog()),
        )

        await service.run_precheck(session, auth_subject, migration.id)
        items, count = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.products,
            status=PrecheckRecordStatus.skipped,
            pagination=PaginationParams(page=1, limit=20),
        )

        assert count == 1
        assert items[0].source_id == "prod_2"
        assert items[0].reason_code == "one_time_product"

    @pytest.mark.auth
    async def test_items_carry_ledger_record_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_catalog()),
        )

        await service.run_precheck(session, auth_subject, migration.id)
        items, _ = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.products,
            status=None,
            pagination=PaginationParams(page=1, limit=20),
        )

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        # every product row exposes the ledger id + status of its staged record
        for item in items:
            assert item.record_id is not None
            assert item.import_status == MerchantMigrationRecordStatus.pending
        prod_1 = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert prod_1 is not None
        assert prod_1.id in {item.record_id for item in items}


def _importable_catalog() -> list[CanonicalRecord]:
    """An importable recurring product, a one-time product that's skipped, and
    a customer."""
    return [
        *_catalog(),
        CanonicalCustomer(
            source_id="cus_1",
            email="alice@example.com",
            name="Alice",
            country="US",
        ),
    ]


async def _staged_migration(
    mocker: MockerFixture,
    session: AsyncSession,
    save_fixture: SaveFixture,
    auth_subject: AuthSubject[User],
    organization: Organization,
    records: list[CanonicalRecord] | None = None,
) -> MerchantMigration:
    migration = await build_connected_migration(save_fixture, organization)
    mocker.patch(
        "polar.merchant_migration.service.StripeAdapter",
        return_value=_FakeAdapter(
            records if records is not None else _importable_catalog()
        ),
    )
    await service.run_precheck(session, auth_subject, migration.id)
    return migration


def _catalog_with_subscription() -> list[CanonicalRecord]:
    """The importable catalog plus an active subscription on the Pro price."""
    return [
        *_importable_catalog(),
        CanonicalSubscription(
            source_id="sub_1",
            customer_source_id="cus_1",
            price_source_id="price_1",
            status=CanonicalSubscriptionStatus.active,
            collection_method=CanonicalCollectionMethod.charge_automatically,
            current_period_start=None,
            current_period_end=None,
            trialing=False,
            paused_collection=False,
            line_item_count=1,
            quantity=1,
            payment_method=None,
        ),
    ]


async def _products(session: AsyncSession, organization: Organization) -> list[Product]:
    result = await session.execute(
        select(Product)
        .where(Product.organization_id == organization.id)
        .options(selectinload(Product.prices))
    )
    return list(result.scalars().unique().all())


@pytest.mark.asyncio
class TestImportCatalog:
    @pytest.mark.auth
    async def test_imports_catalog_and_advances_step(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        assert report.step == MerchantMigrationStep.create_catalog
        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.products].skipped == 1
        assert results[PrecheckEntity.customers].imported == 1
        assert results[PrecheckEntity.customers].skipped == 0

        products = await _products(session, organization)
        assert len(products) == 1
        product = products[0]
        assert product.name == "Pro"
        assert product.recurring_interval == "month"
        assert len(product.prices) == 1
        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)
        assert price.price_amount == 1000
        assert price.price_currency == "usd"

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_email_and_organization(
            "alice@example.com", organization.id
        )
        assert customer is not None
        assert customer.stripe_customer_id == "cus_1"
        assert customer.billing_address is not None
        assert customer.billing_address.country == "US"

        migration_repository = MerchantMigrationRepository.from_session(session)
        updated = await migration_repository.get_by_id(migration.id)
        assert updated is not None
        assert updated.step == MerchantMigrationStep.create_catalog

    @pytest.mark.auth
    async def test_listing_reflects_import_status_after_import(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        await service.import_catalog(session, auth_subject, migration.id)

        items, _ = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.products,
            status=None,
            pagination=PaginationParams(page=1, limit=20),
        )
        by_source = {item.source_id: item for item in items}
        # the imported product now reads as imported; the skipped one as skipped
        assert by_source["prod_1"].import_status == (
            MerchantMigrationRecordStatus.imported
        )
        assert by_source["prod_2"].import_status == (
            MerchantMigrationRecordStatus.skipped
        )

    @pytest.mark.auth
    async def test_imports_subscription_as_paused(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker,
            session,
            save_fixture,
            auth_subject,
            organization,
            records=_catalog_with_subscription(),
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.subscriptions].imported == 1

        result = await session.execute(
            select(Subscription)
            .where(Subscription.organization_id == organization.id)
            .options(selectinload(Subscription.customer))
        )
        subscription = result.scalars().unique().one()
        # held from billing: paused is neither active nor billable, so the
        # renewal scheduler skips it until cutover
        assert subscription.status == SubscriptionStatus.paused
        assert subscription.active is False
        assert subscription.paused_at is not None
        assert subscription.amount == 1000
        assert subscription.currency == "usd"
        assert subscription.customer.email == "alice@example.com"
        assert subscription.user_metadata["stripe_subscription_id"] == "sub_1"

    @pytest.mark.auth
    async def test_subscription_skipped_when_its_product_is_excluded(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker,
            session,
            save_fixture,
            auth_subject,
            organization,
            records=_catalog_with_subscription(),
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        product_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert product_record is not None

        report = await service.import_catalog(
            session,
            auth_subject,
            migration.id,
            exclude_record_ids=[product_record.id],
        )

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.subscriptions].imported == 0
        assert results[PrecheckEntity.subscriptions].skipped == 1

        # The subscription is skipped with a reason, not silently left pending.
        subscription_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert subscription_record is not None
        assert subscription_record.status == MerchantMigrationRecordStatus.skipped
        assert subscription_record.error is not None
        assert subscription_record.target_id is None

    @pytest.mark.auth
    async def test_second_subscription_to_same_product_is_skipped(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Two source subscriptions for the same customer on the same product must
        # not become two Polar subscriptions, or cutover would double-bill.
        catalog = _catalog_with_subscription()
        catalog.append(
            CanonicalSubscription(
                source_id="sub_2",
                customer_source_id="cus_1",
                price_source_id="price_1",
                status=CanonicalSubscriptionStatus.active,
                collection_method=CanonicalCollectionMethod.charge_automatically,
                current_period_start=None,
                current_period_end=None,
                trialing=False,
                paused_collection=False,
                line_item_count=1,
                quantity=1,
                payment_method=None,
            )
        )
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization, records=catalog
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.subscriptions].imported == 1
        assert results[PrecheckEntity.subscriptions].skipped == 1
        result = await session.execute(
            select(Subscription).where(Subscription.organization_id == organization.id)
        )
        assert len(result.scalars().unique().all()) == 1

    @pytest.mark.auth
    async def test_customer_skipped_on_stripe_id_conflict(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # An existing Polar customer sharing the email but carrying a different
        # Stripe id must not be reused, or the card would land on the wrong record.
        await customer_service.create_for_organization(
            session,
            organization,
            email="alice@example.com",
            name="Alice",
            billing_address=None,
            stripe_customer_id="cus_existing",
        )
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.customers].imported == 0
        assert results[PrecheckEntity.customers].skipped == 1
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        customer_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.customer,
            source_id="cus_1",
        )
        assert customer_record is not None
        assert customer_record.status == MerchantMigrationRecordStatus.skipped
        assert customer_record.error is not None

    @pytest.mark.auth
    async def test_rerunning_precheck_does_not_regress_step(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        await service.import_catalog(session, auth_subject, migration.id)

        # Re-running precheck after import must not push the step back to pre_check.
        await service.run_precheck(session, auth_subject, migration.id)

        migration_repository = MerchantMigrationRepository.from_session(session)
        updated = await migration_repository.get_by_id(migration.id)
        assert updated is not None
        assert updated.step == MerchantMigrationStep.create_catalog

    @pytest.mark.auth
    async def test_marks_records_in_the_ledger(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )

        await service.import_catalog(session, auth_subject, migration.id)

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        imported = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert imported is not None
        assert imported.status == MerchantMigrationRecordStatus.imported
        assert imported.target_id is not None

        skipped = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_2:one_time",
        )
        assert skipped is not None
        assert skipped.status == MerchantMigrationRecordStatus.skipped
        assert skipped.error is not None
        assert skipped.target_id is None

    @pytest.mark.auth
    async def test_reuses_existing_customer_by_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        existing = Customer(
            email="alice@example.com",
            name="Existing Alice",
            organization=organization,
        )
        await save_fixture(existing)

        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        await service.import_catalog(session, auth_subject, migration.id)

        customer_repository = CustomerRepository.from_session(session)
        matches = await session.execute(
            select(Customer).where(
                Customer.organization_id == organization.id,
                Customer.email == "alice@example.com",
            )
        )
        customers = list(matches.scalars().all())
        assert len(customers) == 1
        # the existing customer is reused, with the source id reconciled onto it
        reused = customers[0]
        assert reused.id == existing.id
        assert reused.stripe_customer_id == "cus_1"

    @pytest.mark.auth
    async def test_is_idempotent_on_rerun(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )

        first = await service.import_catalog(session, auth_subject, migration.id)
        second = await service.import_catalog(session, auth_subject, migration.id)

        # the second run reports the same counts but creates nothing new
        assert second.results == first.results
        assert len(await _products(session, organization)) == 1
        matches = await session.execute(
            select(Customer).where(
                Customer.organization_id == organization.id,
                Customer.email == "alice@example.com",
            )
        )
        assert len(list(matches.scalars().all())) == 1

    @pytest.mark.auth
    async def test_imports_only_selected_records(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        product_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert product_record is not None

        report = await service.import_catalog(
            session, auth_subject, migration.id, record_ids=[product_record.id]
        )

        results = {result.entity: result for result in report.results}
        # only the selected product is acted on
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.customers].imported == 0

        assert len(await _products(session, organization)) == 1
        # the unselected customer stays pending, available to import later
        customer_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.customer,
            source_id="cus_1",
        )
        assert customer_record is not None
        assert customer_record.status == MerchantMigrationRecordStatus.pending

    @pytest.mark.auth
    async def test_imports_everything_except_excluded(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        product_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert product_record is not None

        report = await service.import_catalog(
            session,
            auth_subject,
            migration.id,
            exclude_record_ids=[product_record.id],
        )

        results = {result.entity: result for result in report.results}
        # everything importable imports except the excluded product
        assert results[PrecheckEntity.products].imported == 0
        assert results[PrecheckEntity.customers].imported == 1
        excluded = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert excluded is not None
        assert excluded.status == MerchantMigrationRecordStatus.pending

    @pytest.mark.auth
    async def test_unselected_records_import_on_a_later_pass(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        product_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        assert product_record is not None

        await service.import_catalog(
            session, auth_subject, migration.id, record_ids=[product_record.id]
        )
        # a second pass with no selection imports what's still pending
        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.customers].imported == 1
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_email_and_organization(
            "alice@example.com", organization.id
        )
        assert customer is not None

    @pytest.mark.auth
    async def test_requires_precheck_first(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)

        with pytest.raises(CatalogImportNotReady):
            await service.import_catalog(session, auth_subject, migration.id)
