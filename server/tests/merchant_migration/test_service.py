from collections.abc import AsyncIterator

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.pagination import PaginationParams
from polar.merchant_migration.canonical import (
    CanonicalAccount,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
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
    InvalidSourceCredentials,
    MissingStripeScopes,
    SourceKeyModeMismatch,
    SourceNotConnected,
    SourceVerificationUnavailable,
    UnsupportedMigrationSource,
)
from polar.merchant_migration.service import merchant_migration as service
from polar.models import (
    MerchantMigration,
    Organization,
    User,
    UserOrganization,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
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
