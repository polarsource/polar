from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit import jwt
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
    SourceNotConnected,
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
from tests.merchant_migration._helpers import build_stripe_oauth_token


class _FakeAdapter:
    def __init__(self, records: list[CanonicalRecord]) -> None:
        self._records = records

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


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_creates_independent_migrations(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)

        first = await service.create(
            session,
            auth_subject,
            MerchantMigrationCreate(
                organization_id=organization.id,
                source_platform=MerchantMigrationSourcePlatform.stripe,
            ),
        )
        second = await service.create(
            session,
            auth_subject,
            MerchantMigrationCreate(
                organization_id=organization.id,
                source_platform=MerchantMigrationSourcePlatform.stripe,
            ),
        )

        assert first.id != second.id
        assert first.step == MerchantMigrationStep.source_setup
        assert first.source_platform == MerchantMigrationSourcePlatform.stripe

        repository = MerchantMigrationRepository.from_session(session)
        migrations = await repository.get_all(
            repository.get_base_statement().where(
                MerchantMigration.organization_id == organization.id
            )
        )
        assert len(migrations) == 2


@pytest.mark.asyncio
class TestCreateStripeAuthorizationUrl:
    @pytest.mark.auth
    async def test_targets_the_given_migration(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(settings, "STRIPE_APP_CLIENT_ID", "ca_test")
        mocker.patch.object(settings, "STRIPE_APP_CLIENT_LINK_ID", "chnlink_test")
        migration = MerchantMigration(
            organization_id=organization.id,
            source_platform=MerchantMigrationSourcePlatform.stripe,
            step=MerchantMigrationStep.source_setup,
        )
        await save_fixture(migration)

        url = await service.create_stripe_authorization_url(
            session,
            auth_subject,
            migration_id=migration.id,
            redirect_uri="http://test/callback",
            return_to="http://test/return",
        )
        assert "chnlink_test" in url
        assert "ca_test" in url

        token = parse_qs(urlparse(url).query)["state"][0]
        state = jwt.decode(token=token, secret=settings.SECRET, type="stripe_app_oauth")
        assert state["migration_id"] == str(migration.id)


@pytest.mark.asyncio
class TestCompleteStripeAuthorization:
    @pytest.mark.auth
    async def test_stores_encrypted_refresh_token(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=build_stripe_oauth_token("rt_secret"),
        )
        migration = MerchantMigration(
            organization_id=organization.id,
            source_platform=MerchantMigrationSourcePlatform.stripe,
            step=MerchantMigrationStep.source_setup,
        )
        await save_fixture(migration)
        state = jwt.encode(
            data={
                "migration_id": str(migration.id),
                "subject_id": str(auth_subject.subject.id),
                "return_to": "/dashboard",
            },
            secret=settings.SECRET,
            type="stripe_app_oauth",
        )

        result = await service.complete_stripe_authorization(
            session, auth_subject, state=state, code="ac_test", error=None
        )
        assert result.error is None

        repository = MerchantMigrationRepository.from_session(session)
        updated = await repository.get_by_id(migration.id)
        assert updated is not None
        credentials = updated.source_credentials
        assert credentials["stripe_user_id"] == "acct_test"
        assert credentials["livemode"] is True
        # the refresh token is stored as ciphertext, never in clear text
        assert credentials["refresh_token_encrypted"] != "rt_secret"
        assert credentials["refresh_token_encrypted"].startswith("v1.")


async def _create_connected_migration(
    save_fixture: SaveFixture, organization: Organization
) -> MerchantMigration:
    migration = MerchantMigration(
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=MerchantMigrationStep.source_setup,
    )
    await save_fixture(migration)
    credentials = await service._build_stripe_credentials(
        migration, build_stripe_oauth_token("rt_old")
    )
    migration.source_credentials = dict(credentials)
    await save_fixture(migration)
    return migration


@pytest.mark.asyncio
class TestRunPrecheck:
    @pytest.mark.auth
    async def test_extracts_rotates_token_and_advances_step(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_connected_migration(save_fixture, organization)
        old_ciphertext = migration.source_credentials["refresh_token_encrypted"]

        refresh = mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.refresh",
            return_value=build_stripe_oauth_token("rt_new"),
        )
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
        refresh.assert_awaited_once_with("rt_old")
        stripe_adapter.assert_called_once_with("rk_test")

        repository = MerchantMigrationRepository.from_session(session)
        updated = await repository.get_by_id(migration.id)
        assert updated is not None
        assert updated.step == MerchantMigrationStep.pre_check
        # the rotated refresh token is re-persisted as fresh ciphertext
        assert updated.source_credentials["refresh_token_encrypted"] != old_ciphertext

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
        migration = await _create_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.refresh",
            return_value=build_stripe_oauth_token("rt_new"),
        )
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
        migration = await _create_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.refresh",
            return_value=build_stripe_oauth_token("rt_new"),
        )
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
