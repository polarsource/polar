from collections.abc import AsyncIterator
from datetime import timedelta
from unittest.mock import Mock
from uuid import UUID

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
from polar.kit.utils import utc_now
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    serialize,
)
from polar.merchant_migration.cards import AmbiguousCopiedCard
from polar.merchant_migration.cutover import CutoverOutcome, SubscriptionCutover
from polar.merchant_migration.pan_transfer import (
    STEP_CUTOVER,
    STEP_MOVE_SUBSCRIPTIONS,
    STEP_RESOLVE_UNCOVERED,
    STEP_VERIFY_CARDS,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.merchant_migration.schemas import (
    MerchantMigrationCreate,
    PrecheckEntity,
    PrecheckReasonLevel,
    PrecheckRecordStatus,
)
from polar.merchant_migration.service import (
    CatalogImportBlocked,
    CatalogImportNotReady,
    CutoverNotStarted,
    InvalidSourceCredentials,
    MissingStripeScopes,
    SourceAccountNotMigratable,
    SourceKeyModeMismatch,
    SourceNotConnected,
    SourceVerificationUnavailable,
    UnsupportedMigrationSource,
)
from polar.merchant_migration.service import merchant_migration as service
from polar.models import (
    Customer,
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    PaymentMethod,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_operation import (
    STALL_THRESHOLD,
    MerchantMigrationOperation,
    MerchantMigrationOperationSelection,
    MerchantMigrationOperationStatus,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.service import product as product_service
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_payment_method,
)
from tests.fixtures.stripe import build_stripe_payment_method
from tests.merchant_migration._helpers import (
    assert_no_migrations,
    build_connected_migration,
    canonical_subscription,
    copied_cards,
    pan_steps_until,
)


class _FakeAdapter:
    def __init__(
        self,
        records: list[CanonicalRecord] | None = None,
        *,
        missing_scopes: list[str] | None = None,
        verify_error: Exception | None = None,
        account_id: str | None = "acct_test",
        source_account: CanonicalAccount | None = None,
    ) -> None:
        self._records = records or []
        self._missing_scopes = missing_scopes or []
        self._verify_error = verify_error
        self._account_id = account_id
        self._source_account = source_account or CanonicalAccount(
            country="US", has_connected_accounts=False
        )
        self.stopped: list[str] = []

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
        return self._source_account

    async def get_subscription(self, source_id: str) -> CanonicalSubscription | None:
        for record in self._records:
            if (
                isinstance(record, CanonicalSubscription)
                and record.source_id == source_id
            ):
                return record
        return None

    async def stop_source_subscription(self, source_id: str, *, reference: str) -> None:
        self.stopped.append(source_id)


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
        await assert_no_migrations(session, organization)

    @pytest.mark.auth
    async def test_source_with_connected_accounts_raises_and_persists_nothing(
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
                source_account=CanonicalAccount(
                    country="US", has_connected_accounts=True
                )
            ),
        )

        with pytest.raises(SourceAccountNotMigratable) as exc_info:
            await service.create(session, auth_subject, _create_schema(organization))

        assert exc_info.value.blockers == ["source_has_connected_accounts"]
        await assert_no_migrations(session, organization)

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

        await assert_no_migrations(session, organization)

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
            records if records is not None else _catalog_with_subscription()
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
            currency="usd",
        ),
    ]


def _multi_currency_catalog() -> list[CanonicalRecord]:
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
                    currency="eur",
                    amount=900,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                ),
                CanonicalPrice(
                    source_id="price_1",
                    currency="usd",
                    amount=1000,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                ),
            ],
        ),
        CanonicalCustomer(
            source_id="cus_1",
            email="alice@example.com",
            name="Alice",
            country="US",
        ),
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
            currency="usd",
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
        assert results[PrecheckEntity.products].skipped == 0
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
    async def test_blocked_organization_cannot_import(
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
        organization.status = OrganizationStatus.CREATED
        await save_fixture(organization)

        with pytest.raises(CatalogImportBlocked):
            await service.import_catalog(session, auth_subject, migration.id)

        assert await _products(session, organization) == []

    @pytest.mark.auth
    async def test_blocked_source_account_cannot_import(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Migrations created before the source account grew a blocker, or before
        # `create` started rejecting them, still have to be caught here.
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(
                source_account=CanonicalAccount(
                    country="US", has_connected_accounts=True
                )
            ),
        )

        with pytest.raises(CatalogImportBlocked) as exc_info:
            await service.import_catalog(session, auth_subject, migration.id)

        assert exc_info.value.blockers == ["source_has_connected_accounts"]
        assert await _products(session, organization) == []

    @pytest.mark.auth
    async def test_settled_records_are_not_reimported(
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
        records = await record_repository.list_by_migration(migration.id)
        for record in records:
            if record.type == MerchantMigrationRecordType.product:
                await record_repository.update(
                    record,
                    update_dict={"status": MerchantMigrationRecordStatus.skipped},
                )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 0
        assert await _products(session, organization) == []

    @pytest.mark.auth
    async def test_import_does_not_notify_for_each_product(
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
        after_created = mocker.spy(product_service, "_after_product_created")

        await service.import_catalog(session, auth_subject, migration.id)

        after_created.assert_not_called()

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
        # Only subscription dependencies are settled by import.
        assert by_source["prod_1"].import_status == (
            MerchantMigrationRecordStatus.imported
        )
        assert (
            by_source["prod_2"].import_status == MerchantMigrationRecordStatus.pending
        )

    @pytest.mark.auth
    async def test_listing_filters_on_import_status(
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

        items, count = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.products,
            status=None,
            import_status=MerchantMigrationRecordStatus.imported,
            pagination=PaginationParams(page=1, limit=20),
        )

        assert count == 1
        assert [item.source_id for item in items] == ["prod_1"]

    @pytest.mark.auth
    async def test_imports_subscription_dependencies_without_creating_subscription(
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
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.customers].imported == 1
        assert results[PrecheckEntity.subscriptions].imported == 0
        assert results[PrecheckEntity.subscriptions].skipped == 0

        result = await session.execute(
            select(Subscription).where(Subscription.organization_id == organization.id)
        )
        assert result.scalars().all() == []

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        subscription_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert subscription_record is not None
        assert subscription_record.status == MerchantMigrationRecordStatus.pending
        assert subscription_record.target_id is None
        items, _ = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.subscriptions,
            status=None,
            pagination=PaginationParams(page=1, limit=20),
        )
        assert len(items) == 1
        assert items[0].dependencies_imported is True
        summary = await service.summarize_records(session, auth_subject, migration.id)
        subscriptions = next(
            entry
            for entry in summary.entities
            if entry.entity == PrecheckEntity.subscriptions
        )
        assert subscriptions.selectable == 0

    @pytest.mark.auth
    async def test_excluded_subscription_leaves_its_dependencies_pending(
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
        subscription_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert subscription_record is not None

        report = await service.import_catalog(
            session,
            auth_subject,
            migration.id,
            exclude_record_ids=[subscription_record.id],
        )

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 0
        assert results[PrecheckEntity.customers].imported == 0
        assert results[PrecheckEntity.subscriptions].imported == 0
        assert results[PrecheckEntity.subscriptions].skipped == 0
        product_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_1:month:1",
        )
        customer_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.customer,
            source_id="cus_1",
        )
        assert product_record is not None
        assert customer_record is not None
        assert product_record.status == MerchantMigrationRecordStatus.pending
        assert customer_record.status == MerchantMigrationRecordStatus.pending
        assert subscription_record.status == MerchantMigrationRecordStatus.pending
        assert subscription_record.target_id is None

    @pytest.mark.auth
    async def test_multiple_subscriptions_prepare_shared_dependencies_once(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
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
                currency="usd",
            )
        )
        migration = await _staged_migration(
            mocker, session, save_fixture, auth_subject, organization, records=catalog
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.customers].imported == 1
        assert results[PrecheckEntity.subscriptions].imported == 0
        assert results[PrecheckEntity.subscriptions].skipped == 0
        result = await session.execute(
            select(Subscription).where(Subscription.organization_id == organization.id)
        )
        assert result.scalars().all() == []
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        records = await record_repository.list_by_migration(migration.id)
        subscription_records = [
            record
            for record in records
            if record.type == MerchantMigrationRecordType.subscription
        ]
        assert len(subscription_records) == 2
        assert all(
            record.status == MerchantMigrationRecordStatus.pending
            and record.target_id is None
            for record in subscription_records
        )

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

        unrelated = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.product,
            source_id="prod_2:one_time",
        )
        assert unrelated is not None
        assert unrelated.status == MerchantMigrationRecordStatus.pending
        assert unrelated.error is None
        assert unrelated.target_id is None

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
    async def test_product_and_customer_ids_do_not_select_dependencies(
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
        assert results[PrecheckEntity.products].imported == 0
        assert results[PrecheckEntity.customers].imported == 0

        assert await _products(session, organization) == []
        customer_record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.customer,
            source_id="cus_1",
        )
        assert customer_record is not None
        assert customer_record.status == MerchantMigrationRecordStatus.pending

    @pytest.mark.auth
    async def test_import_then_cutover_creates_and_activates_subscription(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        catalog = [*_importable_catalog(), canonical_subscription()]
        adapter = _FakeAdapter(catalog)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )
        copied_cards(mocker, build_stripe_payment_method(customer="cus_1"))
        migration = await build_connected_migration(save_fixture, organization)
        await service.run_precheck(session, auth_subject, migration.id)
        await service.import_catalog(session, auth_subject, migration.id)

        result = await session.execute(
            select(Subscription).where(Subscription.organization_id == organization.id)
        )
        assert result.scalars().unique().all() == []

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        record = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert record is not None
        assert record.status == MerchantMigrationRecordStatus.pending

        outcome = await SubscriptionCutover(session, migration, adapter).run(record)

        assert outcome.status == MerchantMigrationCutoverStatus.moved
        assert adapter.stopped == ["sub_1"]
        switched = await record_repository.get_by_source(
            organization_id=organization.id,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
        )
        assert switched is not None
        assert switched.status == MerchantMigrationRecordStatus.imported
        assert switched.target_id is not None
        subscription = await SubscriptionRepository.from_session(session).get_by_id(
            switched.target_id
        )
        assert subscription is not None
        assert subscription.status == SubscriptionStatus.active
        assert subscription.user_metadata["stripe_subscription_id"] == "sub_1"

    @pytest.mark.auth
    async def test_excluded_product_id_is_ignored_when_subscriptions_exist(
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
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.customers].imported == 1
        assert results[PrecheckEntity.subscriptions].imported == 0
        assert product_record.status == MerchantMigrationRecordStatus.imported

    @pytest.mark.auth
    async def test_catalog_without_subscriptions_imports_nothing(
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
            records=_importable_catalog(),
        )
        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 0
        assert results[PrecheckEntity.customers].imported == 0
        assert await _products(session, organization) == []

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

    @pytest.mark.auth
    async def test_multi_currency_price_imports_every_currency(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        records = _multi_currency_catalog()
        migration = await _staged_migration(
            mocker,
            session,
            save_fixture,
            auth_subject,
            organization,
            records=records,
        )

        report = await service.import_catalog(session, auth_subject, migration.id)

        results = {result.entity: result for result in report.results}
        assert results[PrecheckEntity.products].imported == 1
        assert results[PrecheckEntity.subscriptions].imported == 0

        products = await _products(session, organization)
        assert len(products) == 1
        assert {
            (price.price_currency, price.price_amount)
            for price in products[0].prices
            if isinstance(price, ProductPriceFixed)
        } == {("eur", 900), ("usd", 1000)}


@pytest.mark.asyncio
class TestSummarizeRecords:
    @pytest.mark.auth
    async def test_summary_counts_match_the_listing_after_import(
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

        summary = await service.summarize_records(session, auth_subject, migration.id)

        by_entity = {entry.entity: entry for entry in summary.entities}
        # prices ride along with their product, so they get no row of their own
        assert set(by_entity) == {
            PrecheckEntity.products,
            PrecheckEntity.customers,
            PrecheckEntity.subscriptions,
        }

        products = by_entity[PrecheckEntity.products]
        # the fixture stages one importable product and one the pre-check skips
        assert products.total == 2
        assert products.importable == 1
        assert products.skipped == 1
        assert products.imported == 1
        assert products.pending == 1
        assert products.action_required == 0
        assert products.selectable == 0

        customers = by_entity[PrecheckEntity.customers]
        assert customers.total == 1
        assert customers.imported == 1
        assert customers.pending == 0
        assert customers.selectable == 0

        items, count = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=None,
            status=None,
            reason_level=PrecheckReasonLevel.action_required,
            pagination=PaginationParams(page=1, limit=100),
        )
        assert summary.action_required == count
        assert sum(entity.action_required for entity in summary.entities) == count

    @pytest.mark.auth
    async def test_summary_counts_what_is_still_selectable(
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

        summary = await service.summarize_records(session, auth_subject, migration.id)

        by_entity = {entry.entity: entry for entry in summary.entities}
        products = by_entity[PrecheckEntity.products]
        assert products.imported == 0
        assert products.pending == 2
        assert products.selectable == 0
        subscriptions = by_entity[PrecheckEntity.subscriptions]
        assert subscriptions.pending == 1
        assert subscriptions.selectable == 1


def _canonical_subscription(
    *,
    source_id: str,
    payment_method: CanonicalPaymentMethod | None,
    customer_source_id: str | None = None,
    price_source_id: str | None = None,
) -> CanonicalSubscription:
    return CanonicalSubscription(
        source_id=source_id,
        customer_source_id=customer_source_id or f"cus_{source_id}",
        price_source_id=price_source_id or f"price_{source_id}",
        status=CanonicalSubscriptionStatus.active,
        collection_method=CanonicalCollectionMethod.charge_automatically,
        current_period_start=utc_now(),
        current_period_end=utc_now() + timedelta(days=30),
        trialing=False,
        paused_collection=False,
        line_item_count=1,
        quantity=1,
        payment_method=payment_method,
        has_discount=False,
        cancel_at_period_end=False,
        trial_end=None,
        stopped_for_migration=False,
        currency="usd",
    )


async def _imported_subscription(
    save_fixture: SaveFixture,
    migration: MerchantMigration,
    organization: Organization,
    product: Product,
    *,
    source_id: str,
    email: str,
    payment_method: CanonicalPaymentMethod | None = None,
) -> MerchantMigrationRecord:
    """A pending subscription whose customer and product are already in Polar."""
    customer = await create_customer(
        save_fixture, organization=organization, email=email
    )
    await save_fixture(
        MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.customer,
            status=MerchantMigrationRecordStatus.imported,
            source_id=f"cus_{source_id}",
            target_id=customer.id,
            canonical=serialize(
                CanonicalCustomer(
                    source_id=f"cus_{source_id}",
                    email=email,
                    name=None,
                    country=None,
                )
            ),
        )
    )
    await save_fixture(
        MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.product,
            status=MerchantMigrationRecordStatus.imported,
            source_id=f"prod_{source_id}:month:1",
            target_id=product.id,
            canonical=serialize(
                CanonicalProduct(
                    source_id=f"prod_{source_id}:month:1",
                    product_source_id=f"prod_{source_id}",
                    name="Product",
                    recurring_interval="month",
                    recurring_interval_count=1,
                    prices=[
                        CanonicalPrice(
                            source_id=f"price_{source_id}",
                            currency="usd",
                            amount=1000,
                            pricing_scheme=CanonicalPricingScheme.fixed,
                        )
                    ],
                )
            ),
        )
    )
    record = MerchantMigrationRecord(
        merchant_migration=migration,
        organization=organization,
        type=MerchantMigrationRecordType.subscription,
        status=MerchantMigrationRecordStatus.pending,
        source_id=source_id,
        canonical=serialize(
            _canonical_subscription(source_id=source_id, payment_method=payment_method)
        ),
    )
    await save_fixture(record)
    return record


@pytest.mark.asyncio
class TestRunCardVerification:
    @pytest.mark.auth
    async def test_links_card_to_pending_subscription_customer(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await _staged_migration(
            mocker,
            session,
            save_fixture,
            auth_subject,
            organization,
            records=_catalog_with_subscription(),
        )
        await service.import_catalog(session, auth_subject, migration.id)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("alice@example.com", organization.id)
        assert customer is not None
        payment_method = await create_payment_method(
            save_fixture, customer, processor_id="pm_pending"
        )
        link = mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(return_value=payment_method),
        )

        await service.run_card_verification(session, migration.id)

        link.assert_awaited_once()
        result = await session.execute(
            select(Subscription).where(Subscription.organization_id == organization.id)
        )
        assert result.scalars().all() == []

    async def test_links_landed_cards_and_reports_the_shortfall(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_covered",
            email="covered@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_uncovered",
            email="uncovered@example.com",
        )
        covered_customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("covered@example.com", organization.id)
        assert covered_customer is not None
        payment_method = await create_payment_method(
            save_fixture, covered_customer, processor_id="pm_copied"
        )
        mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(
                side_effect=lambda _session, customer, **_kwargs: (
                    payment_method if customer.id == covered_customer.id else None
                )
            ),
        )

        await service.run_card_verification(session, migration.id)

        checklist = service._checklist(migration)
        assert checklist.current_step_key == STEP_RESOLVE_UNCOVERED

    async def test_re_running_picks_up_only_what_arrived_since(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        """Merchants re-run the copy for the customers it missed, so this runs
        again over subscriptions it has already linked."""
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_first",
            email="first@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_late",
            email="late@example.com",
        )
        customer_repository = CustomerRepository.from_session(session)
        first_customer = await customer_repository.get_by_email_and_organization(
            "first@example.com", organization.id
        )
        late_customer = await customer_repository.get_by_email_and_organization(
            "late@example.com", organization.id
        )
        assert first_customer is not None
        assert late_customer is not None

        landed: dict[UUID, PaymentMethod] = {}

        async def _link(
            _session: AsyncSession, customer: Customer, **_kwargs: object
        ) -> PaymentMethod | None:
            return landed.get(customer.id)

        link = mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(side_effect=_link),
        )

        landed[first_customer.id] = await create_payment_method(
            save_fixture, first_customer, processor_id="pm_first"
        )
        await service.run_card_verification(session, migration.id)

        landed[late_customer.id] = await create_payment_method(
            save_fixture, late_customer, processor_id="pm_late"
        )
        link.reset_mock()
        await service.run_card_verification(session, migration.id)

        assert {call.args[1].id for call in link.await_args_list} == {
            first_customer.id,
            late_customer.id,
        }

    async def test_links_the_card_the_source_was_charging(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        charged = CanonicalPaymentMethod(
            source_id="pm_source",
            type=CanonicalPaymentMethodType.card,
            brand="visa",
            last4="4242",
            exp_month=4,
            exp_year=2030,
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="two-cards@example.com",
            payment_method=charged,
        )
        customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("two-cards@example.com", organization.id)
        assert customer is not None
        linked = await create_payment_method(
            save_fixture, customer, processor_id="pm_charged"
        )
        link = mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(return_value=linked),
        )

        await service.run_card_verification(session, migration.id)

        # Without this the wrong copy can be attached, and the switch keeps it.
        assert link.await_args is not None
        assert link.await_args.kwargs["source_method"] == charged

    async def test_an_ambiguous_card_skips_that_customer_only(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_ambiguous",
            email="ambiguous@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_clear",
            email="clear@example.com",
        )
        customer_repository = CustomerRepository.from_session(session)
        ambiguous_customer = await customer_repository.get_by_email_and_organization(
            "ambiguous@example.com", organization.id
        )
        clear_customer = await customer_repository.get_by_email_and_organization(
            "clear@example.com", organization.id
        )
        assert ambiguous_customer is not None
        assert clear_customer is not None
        linked = await create_payment_method(
            save_fixture, clear_customer, processor_id="pm_clear"
        )

        async def _link(
            _session: AsyncSession, customer: Customer, **_kwargs: object
        ) -> PaymentMethod | None:
            if customer.id == ambiguous_customer.id:
                raise AmbiguousCopiedCard(customer.id, 2)
            return linked

        mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(side_effect=_link),
        )

        await service.run_card_verification(session, migration.id)

        checklist = service._checklist(migration)
        assert checklist.current_step_key == STEP_RESOLVE_UNCOVERED

    async def test_lists_a_customer_once_however_many_subscriptions(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)
        first = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_one",
            email="holder@example.com",
        )
        await save_fixture(
            MerchantMigrationRecord(
                merchant_migration=migration,
                organization=organization,
                type=MerchantMigrationRecordType.subscription,
                status=MerchantMigrationRecordStatus.pending,
                source_id="sub_two",
                canonical=first.canonical,
            )
        )
        customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("holder@example.com", organization.id)
        assert customer is not None
        linked = await create_payment_method(
            save_fixture, customer, processor_id="pm_shared"
        )
        link = mocker.patch(
            "polar.merchant_migration.service.link_payment_method",
            new=mocker.AsyncMock(return_value=linked),
        )

        await service.run_card_verification(session, migration.id)

        assert link.await_count == 1


def _fake_cutover(
    mocker: MockerFixture,
    outcome: CutoverOutcome | None = None,
) -> Mock:
    """Stand in for the Stripe-touching engine: record every subscription it's
    asked to switch and answer with a fixed outcome."""
    outcome = outcome or CutoverOutcome(MerchantMigrationCutoverStatus.moved)
    runner = mocker.Mock(run=mocker.AsyncMock(return_value=outcome))
    mocker.patch(
        "polar.merchant_migration.service.SubscriptionCutover",
        return_value=runner,
    )
    mocker.patch.object(
        service, "_build_adapter", new=mocker.AsyncMock(return_value=object())
    )
    return runner


@pytest.mark.asyncio
class TestStartCutover:
    @pytest.mark.auth
    async def test_confirms_step_stores_selection_and_enqueues(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_CUTOVER
        )
        await save_fixture(migration)
        record = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="a@example.com",
        )

        report = await service.start_cutover(
            session, auth_subject, migration.id, record_ids=[record.id]
        )

        await session.refresh(migration)
        assert service._step_completed(migration, STEP_CUTOVER)
        # Confirming the step moves the migration into the switch phase.
        assert migration.step == MerchantMigrationStep.activate_subscriptions
        assert migration.operation is not None
        assert migration.operation.status == MerchantMigrationOperationStatus.running
        assert migration.operation.selection is not None
        assert migration.operation.selection.record_ids == [record.id]
        enqueue.assert_called_once_with(
            "merchant_migration.cutover", merchant_migration_id=migration.id
        )
        assert report.started is True
        assert report.running is True

    @pytest.mark.auth
    async def test_not_reachable_before_the_switch_step(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_VERIFY_CARDS
        )
        await save_fixture(migration)

        with pytest.raises(CutoverNotStarted):
            await service.start_cutover(session, auth_subject, migration.id)

    @pytest.mark.auth
    async def test_retry_reopens_only_non_moved(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        # Already switched once: the step is done and the migration is at cleanup.
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, None
        )
        migration.step = MerchantMigrationStep.cleanup
        await save_fixture(migration)
        moved = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_moved",
            email="moved@example.com",
        )
        skipped = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_skipped",
            email="skipped@example.com",
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.update(
            moved,
            update_dict={"cutover_status": MerchantMigrationCutoverStatus.moved},
            flush=True,
        )
        await record_repository.update(
            skipped,
            update_dict={
                "cutover_status": MerchantMigrationCutoverStatus.skipped,
                "cutover_error": "Renews too soon.",
            },
            flush=True,
        )

        await service.start_cutover(session, auth_subject, migration.id)

        await session.refresh(moved)
        await session.refresh(skipped)
        # What moved stays moved; the skipped one re-opens for another look.
        assert moved.cutover_status == MerchantMigrationCutoverStatus.moved
        assert skipped.cutover_status is None
        assert skipped.cutover_error is None
        enqueue.assert_called_once_with(
            "merchant_migration.cutover", merchant_migration_id=migration.id
        )


@pytest.mark.asyncio
class TestRunCutover:
    async def test_moves_one_then_reenqueues(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")
        runner = _fake_cutover(mocker)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running
        )
        await save_fixture(migration)
        first = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="1@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_2",
            email="2@example.com",
        )

        await service.run_cutover(session, migration.id)

        await session.flush()
        await session.refresh(first)
        # One subscription per run, and it hands off to the next.
        assert runner.run.await_count == 1
        assert first.cutover_status == MerchantMigrationCutoverStatus.moved
        enqueue.assert_called_once_with(
            "merchant_migration.cutover", merchant_migration_id=migration.id
        )

    async def test_finishes_when_nothing_is_left(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        _fake_cutover(mocker)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running
        )
        await save_fixture(migration)
        settled = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_done",
            email="done@example.com",
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.update(
            settled,
            update_dict={"cutover_status": MerchantMigrationCutoverStatus.moved},
            flush=True,
        )

        await service.run_cutover(session, migration.id)

        await session.flush()
        await session.refresh(migration)
        assert service._step_completed(migration, STEP_MOVE_SUBSCRIPTIONS)
        assert migration.step == MerchantMigrationStep.cleanup
        assert migration.operation is not None
        assert migration.operation.status == MerchantMigrationOperationStatus.done

    async def test_honours_the_selection(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        runner = _fake_cutover(mocker)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        picked = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_picked",
            email="picked@example.com",
        )
        untouched = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_untouched",
            email="untouched@example.com",
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            selection=MerchantMigrationOperationSelection(record_ids=[picked.id]),
        )
        await save_fixture(migration)

        # Run until the selected subset is exhausted.
        await service.run_cutover(session, migration.id)
        await session.flush()
        await service.run_cutover(session, migration.id)
        await session.flush()

        await session.refresh(picked)
        await session.refresh(untouched)
        assert runner.run.await_count == 1
        assert picked.cutover_status == MerchantMigrationCutoverStatus.moved
        # Outside the selection: never looked at.
        assert untouched.cutover_status is None

    async def test_skips_when_renewals_disabled(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        runner = _fake_cutover(mocker)
        organization.capabilities = {**STATUS_CAPABILITIES[OrganizationStatus.CREATED]}
        await save_fixture(organization)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running
        )
        await save_fixture(migration)
        record = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="1@example.com",
        )

        await service.run_cutover(session, migration.id)

        await session.refresh(record)
        await session.refresh(migration)
        # Nothing on the source is touched while the org can't bill renewals.
        assert runner.run.await_count == 0
        assert record.cutover_status is None
        assert migration.operation is not None
        assert migration.operation.status == MerchantMigrationOperationStatus.failed
        assert migration.operation.error is not None

    async def test_does_not_finish_while_another_worker_holds_the_lock(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        runner = _fake_cutover(mocker)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running
        )
        await save_fixture(migration)
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="1@example.com",
        )

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        mocker.patch.object(
            record_repository,
            "get_next_cutover_candidate",
            return_value=None,
        )
        mocker.patch.object(
            record_repository,
            "has_pending_cutover_candidates",
            return_value=True,
        )
        mocker.patch.object(
            MerchantMigrationRecordRepository,
            "from_session",
            return_value=record_repository,
        )

        await service.run_cutover(session, migration.id)

        await session.refresh(migration)
        assert runner.run.await_count == 0
        assert migration.operation.status == MerchantMigrationOperationStatus.running
        assert migration.step != MerchantMigrationStep.cleanup

    async def test_skips_when_operation_is_terminal(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        runner = _fake_cutover(mocker)
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.failed,
            error="Switch stalled with no progress; start it again to resume.",
        )
        await save_fixture(migration)
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="1@example.com",
        )

        await service.run_cutover(session, migration.id)

        assert runner.run.await_count == 0


@pytest.mark.asyncio
class TestGetCutoverReport:
    @pytest.mark.auth
    async def test_counts_the_imported_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_CUTOVER
        )
        await save_fixture(migration)
        moved = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_moved",
            email="moved@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_pending",
            email="pending@example.com",
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.update(
            moved,
            update_dict={"cutover_status": MerchantMigrationCutoverStatus.moved},
            flush=True,
        )

        report = await service.get_cutover_report(session, auth_subject, migration.id)

        assert report.total == 2
        assert report.moved == 1
        assert report.pending == 1
        assert report.started is False

    @pytest.mark.auth
    async def test_counts_all_imports_even_with_a_selection(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_CUTOVER
        )
        picked = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_picked",
            email="picked@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_outside",
            email="outside@example.com",
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            selection=MerchantMigrationOperationSelection(record_ids=[picked.id]),
        )
        await save_fixture(migration)

        report = await service.get_cutover_report(session, auth_subject, migration.id)

        # The picker lists every imported subscription; tab counts must match.
        assert report.total == 2
        assert report.pending == 2

    @pytest.mark.auth
    async def test_marks_a_stalled_switch_failed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, STEP_MOVE_SUBSCRIPTIONS
        )
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now() - STALL_THRESHOLD - timedelta(minutes=1),
        )
        await save_fixture(migration)

        report = await service.get_cutover_report(session, auth_subject, migration.id)

        await session.refresh(migration)
        assert report.running is False
        assert report.completed is True
        assert migration.operation is not None
        assert migration.operation.status == MerchantMigrationOperationStatus.failed


@pytest.mark.asyncio
class TestListRecordsCutover:
    @pytest.mark.auth
    async def test_carries_cutover_fields_and_coverage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        await save_fixture(migration)
        record = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_1",
            email="a@example.com",
        )
        customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("a@example.com", organization.id)
        assert customer is not None
        await create_payment_method(save_fixture, customer, processor_id="pm_1")
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.update(
            record,
            update_dict={
                "cutover_status": MerchantMigrationCutoverStatus.skipped,
                "cutover_error": "Renews too soon.",
            },
            flush=True,
        )

        items, _ = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.subscriptions,
            status=None,
            pagination=PaginationParams(page=1, limit=50),
        )

        assert len(items) == 1
        item = items[0]
        assert item.cutover_status == MerchantMigrationCutoverStatus.skipped
        assert item.cutover_error == "Renews too soon."
        assert item.has_payment_method is True
        assert item.renews_at is not None

    @pytest.mark.auth
    async def test_filters_on_cutover_status(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        await save_fixture(migration)
        skipped = await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_skipped",
            email="skipped@example.com",
        )
        await _imported_subscription(
            save_fixture,
            migration,
            organization,
            product,
            source_id="sub_pending",
            email="pending@example.com",
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.update(
            skipped,
            update_dict={"cutover_status": MerchantMigrationCutoverStatus.skipped},
            flush=True,
        )

        items, count = await service.list_records(
            session,
            auth_subject,
            migration.id,
            entity=PrecheckEntity.subscriptions,
            status=None,
            cutover_status=MerchantMigrationCutoverStatus.skipped,
            pagination=PaginationParams(page=1, limit=50),
        )

        assert count == 1
        assert items[0].source_id == "sub_skipped"
