from collections.abc import Awaitable, Callable
from datetime import timedelta

import pytest
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.utils import utc_now
from polar.merchant_migration.adapters.base import ExtractionPage
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
    serialize,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.merchant_migration.service import (
    merchant_migration as merchant_migration_service,
)
from polar.models import (
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    UserOrganization,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_operation import (
    STALL_THRESHOLD,
    MerchantMigrationOperation,
    MerchantMigrationOperationStatus,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.merchant_migration._helpers import (
    assert_no_migrations,
    build_connected_migration,
    canonical_subscription,
    pan_steps_until,
)

VALID_BODY = {
    "source_platform": "stripe",
    "api_key": "rk_test_123",
}


def _body(organization: Organization, **overrides: object) -> dict[str, object]:
    return {**VALID_BODY, "organization_id": str(organization.id), **overrides}


async def _enable_feature(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "merchant_migration_enabled": True,
    }
    await save_fixture(organization)


def _mock_stripe_adapter(
    mocker: MockerFixture,
    *,
    missing_scopes: list[str] | None = None,
    auth_error: Exception | None = None,
    has_connected_accounts: bool = False,
    account_id: str = "acct_test",
) -> None:
    adapter = mocker.MagicMock()
    if auth_error is not None:
        adapter.verify_scopes = mocker.AsyncMock(side_effect=auth_error)
    else:
        adapter.verify_scopes = mocker.AsyncMock(return_value=missing_scopes or [])
    adapter.get_account_id = mocker.AsyncMock(return_value=account_id)
    adapter.get_source_account = mocker.AsyncMock(
        return_value=CanonicalAccount(
            country="US", has_connected_accounts=has_connected_accounts
        )
    )
    mocker.patch("polar.merchant_migration.service.StripeAdapter", return_value=adapter)


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_member_returns_403(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_feature_disabled_returns_403(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_invalid_key_format_returns_422(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization, api_key="nope")
        )
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_scopes_returns_400(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(mocker, missing_scopes=["Subscriptions (write)"])

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 400
        assert "Subscriptions (write)" in response.text

        await assert_no_migrations(session, organization)

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_invalid_key_returns_400(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(
            mocker, auth_error=stripe_lib.AuthenticationError("bad key")
        )

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 400

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_source_with_connected_accounts_returns_400(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(mocker, has_connected_accounts=True)

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 400
        assert "Connect accounts" in response.text

        await assert_no_migrations(session, organization)

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_creates_connected_migration(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        _mock_stripe_adapter(mocker)

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )
        assert response.status_code == 201
        body = response.json()
        assert body["source_platform"] == "stripe"
        assert body["step"] == "source_setup"
        assert body["source_connected"] is True
        assert body["source"]["stripe_user_id"] == "acct_test"
        assert "source_credentials" not in body

        repository = MerchantMigrationRepository.from_session(session)
        stored = await repository.get_by_id(body["id"])
        assert stored is not None
        assert stored.source_credentials["api_key_encrypted"].startswith("v1.")

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_reused_stripe_account_returns_409(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        await build_connected_migration(save_fixture, organization_second)
        _mock_stripe_adapter(mocker)

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )

        assert response.status_code == 409
        assert (
            "already used by another organization's merchant migration" in response.text
        )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_same_organization_can_reuse_stripe_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        await _enable_feature(save_fixture, organization)
        existing = await build_connected_migration(save_fixture, organization)
        _mock_stripe_adapter(mocker)

        response = await client.post(
            "/v1/merchant-migrations/", json=_body(organization)
        )

        assert response.status_code == 201
        body = response.json()
        assert body["id"] != str(existing.id)
        assert body["source"]["stripe_user_id"] == "acct_test"


@pytest.mark.asyncio
class TestGet:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_not_member_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization_second)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_member_returns_migration(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["id"] == str(migration.id)
        assert json_body["source_platform"] == "stripe"
        assert json_body["operation"] is None
        assert "source_credentials" not in json_body

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_returns_stalled_operation(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        migration.operation = MerchantMigrationOperation(
            status=MerchantMigrationOperationStatus.running,
            last_progress_at=utc_now() - STALL_THRESHOLD - timedelta(minutes=1),
        )
        await save_fixture(migration)

        response = await client.get(f"/v1/merchant-migrations/{migration.id}")

        assert response.status_code == 200
        assert response.json()["operation"]["stalled"] is True


@pytest.mark.asyncio
class TestList:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/merchant-migrations/",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_read}))
    async def test_returns_only_org_migrations(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        await _create_migration(save_fixture, organization_second)

        response = await client.get(
            "/v1/merchant-migrations/",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["pagination"]["total_count"] == 1
        item = json_body["items"][0]
        assert item["id"] == str(migration.id)
        assert item["step"] == "source_setup"
        assert item["operation"] is None
        assert "source_credentials" not in item


@pytest.mark.asyncio
class TestPrecheck:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_starts_and_returns_pending_operation(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        _mock_stripe_adapter(mocker)
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["id"] == str(migration.id)
        assert json_body["step"] == "source_setup"
        assert json_body["operation"]["status"] == "pending"
        enqueue.assert_called_once_with(
            "merchant_migration.precheck", merchant_migration_id=migration.id
        )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_coupon_scopes_return_failed_operation(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.step = MerchantMigrationStep.pre_check
        await save_fixture(migration)
        _mock_stripe_adapter(mocker, missing_scopes=["Coupons", "Promotion codes"])
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")

        assert response.status_code == 200
        operation = response.json()["operation"]
        assert operation["status"] == "failed"
        assert "Coupons" in operation["error"]
        assert "Promotion codes" in operation["error"]
        assert response.json()["step"] == "pre_check"
        enqueue.assert_not_called()


@pytest.mark.asyncio
class TestReconnectSource:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/source",
            json={"api_key": "rk_test_replaced"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_missing_scopes_returns_400(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        _mock_stripe_adapter(mocker, missing_scopes=["Coupons", "Promotion codes"])

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/source",
            json={"api_key": "rk_test_incomplete"},
        )

        assert response.status_code == 400
        assert "Coupons" in response.text
        assert "Promotion codes" in response.text

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_different_account_returns_409(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        _mock_stripe_adapter(mocker, account_id="acct_other")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/source",
            json={"api_key": "rk_test_other"},
        )

        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_replaces_key_for_the_same_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        _mock_stripe_adapter(mocker)

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/source",
            json={"api_key": "rk_test_replaced"},
        )

        assert response.status_code == 200
        assert response.json()["id"] == str(migration.id)


StartAndExecutePrecheck = Callable[[MerchantMigration], Awaitable[None]]


@pytest.fixture
def start_and_execute_precheck(
    client: AsyncClient, session: AsyncSession, mocker: MockerFixture
) -> StartAndExecutePrecheck:
    async def run(migration: MerchantMigration) -> None:
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/precheck")
        assert response.status_code == 200
        await merchant_migration_service.execute_precheck(session, migration.id)
        await session.flush()

    return run


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
        )
    ]


@pytest.mark.asyncio
class TestRecords:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "products"},
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_lists_classified_records(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
        start_and_execute_precheck: StartAndExecutePrecheck,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.verify_scopes = mocker.AsyncMock(return_value=[])
        adapter.extract_page = mocker.AsyncMock(
            return_value=ExtractionPage(_catalog(), None)
        )
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", has_connected_accounts=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        await start_and_execute_precheck(migration)

        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "products"},
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["pagination"]["total_count"] == 1
        assert json_body["items"][0]["source_id"] == "prod_1"
        assert json_body["items"][0]["status"] == "importable"


def _catalog_with_customer() -> list[CanonicalRecord]:
    return [
        *_catalog(),
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


@pytest.mark.asyncio
class TestImport:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_precheck_required_returns_409(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_imports_catalog(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
        start_and_execute_precheck: StartAndExecutePrecheck,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.verify_scopes = mocker.AsyncMock(return_value=[])
        adapter.extract_page = mocker.AsyncMock(
            return_value=ExtractionPage(_catalog_with_customer(), None)
        )
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", has_connected_accounts=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        await start_and_execute_precheck(migration)

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/import")
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["step"] == "create_catalog"
        results = {result["entity"]: result for result in json_body["results"]}
        assert results["products"]["imported"] == 1
        assert results["customers"]["imported"] == 1

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_imports_selected_subscription_dependencies(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
        start_and_execute_precheck: StartAndExecutePrecheck,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        adapter = mocker.MagicMock()
        adapter.verify_scopes = mocker.AsyncMock(return_value=[])
        adapter.extract_page = mocker.AsyncMock(
            return_value=ExtractionPage(_catalog_with_customer(), None)
        )
        adapter.get_source_account = mocker.AsyncMock(
            return_value=CanonicalAccount(country="US", has_connected_accounts=False)
        )
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter", return_value=adapter
        )

        await start_and_execute_precheck(migration)

        records = await client.get(
            f"/v1/merchant-migrations/{migration.id}/records",
            params={"entity": "subscriptions"},
        )
        subscription_record_id = records.json()["items"][0]["record_id"]
        assert subscription_record_id is not None
        assert records.json()["items"][0]["tax_behavior"] == "inclusive"

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/import",
            json={"record_ids": [subscription_record_id]},
        )
        assert response.status_code == 200
        results = {r["entity"]: r for r in response.json()["results"]}
        assert results["customers"]["imported"] == 1
        assert results["products"]["imported"] == 1


def _configure_destination(mocker: MockerFixture) -> None:
    mocker.patch.object(
        settings, "MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID", "acct_polar"
    )


@pytest.mark.asyncio
class TestGetPanTransfer:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_started_still_reports_the_method(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(save_fixture, organization)

        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["method"] == "pan_copy"
        assert json_body["started"] is False
        assert json_body["steps"] == []
        assert json_body["current_step_key"] is None


@pytest.mark.asyncio
class TestStartPanTransfer:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_start_requires_an_imported_catalog(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(save_fixture, organization)

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_start_needs_a_destination_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(
            settings, "MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID", ""
        )
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )

        # Otherwise we'd tell the merchant we shared an account and show nothing.
        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_start_lays_out_the_checklist(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 200
        json_body = response.json()
        assert json_body["started"] is True
        # Sharing our destination account is information only, so the merchant
        # opens on the step they actually have to do.
        assert json_body["current_step_key"] == "start_copy"

        migration_response = await client.get(f"/v1/merchant-migrations/{migration.id}")
        assert migration_response.json()["step"] == "copy_cards"

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_start_is_not_repeatable(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        assert (
            await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")
        ).status_code == 200

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestCompletePanTransferStep:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_advances_and_persists(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete",
            json={"inputs": {"stripe_migration_request_id": "migreq_123"}},
        )
        assert response.status_code == 200
        assert response.json()["current_step_key"] == "authorize_copy"

        reread = await client.get(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer"
        )
        steps = {step["key"]: step for step in reread.json()["steps"]}
        assert steps["start_copy"]["status"] == "completed"
        assert steps["start_copy"]["completed_by"] == "merchant"
        assert steps["start_copy"]["inputs"] == {
            "stripe_migration_request_id": "migreq_123"
        }

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_requires_stripe_migration_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete",
            json={"inputs": {}},
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == [
            "body",
            "inputs",
            "stripe_migration_request_id",
        ]

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_rejects_invalid_stripe_migration_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete",
            json={"inputs": {"stripe_migration_request_id": "mig_123"}},
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["type"] == "string_pattern_mismatch"
        assert response.json()["detail"][0]["loc"] == [
            "body",
            "inputs",
            "stripe_migration_request_id",
        ]

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_rejects_an_ops_step(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")
        await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete",
            json={"inputs": {"stripe_migration_request_id": "migreq_123"}},
        )

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/authorize_copy/complete"
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_rejects_skipping_ahead(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/cutover/complete"
        )
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_rejects_unknown_inputs(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )
        await client.post(f"/v1/merchant-migrations/{migration.id}/pan-transfer")

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete",
            json={
                "inputs": {
                    "stripe_migration_request_id": "migreq_123",
                    "whatever": "x",
                }
            },
        )
        # Per-field, so the client can point at the offending input.
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "inputs", "whatever"]

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_complete_before_start(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        _configure_destination(mocker)
        migration = await _create_migration(save_fixture, organization)

        response = await client.post(
            f"/v1/merchant-migrations/{migration.id}/pan-transfer/steps/start_copy/complete"
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestCutover:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.post(f"/v1/merchant-migrations/{migration.id}/cutover")
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_not_reachable_returns_409(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, "verify_cards"
        )
        await save_fixture(migration)

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/cutover")
        assert response.status_code == 409

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_confirms_and_reports(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, "cutover"
        )
        await save_fixture(migration)

        response = await client.post(f"/v1/merchant-migrations/{migration.id}/cutover")
        assert response.status_code == 200
        assert response.json()["started"] is True
        assert response.json()["running"] is True
        enqueue.assert_called_once_with(
            "merchant_migration.cutover", merchant_migration_id=migration.id
        )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_get_report_before_confirmation(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        migration.pan_transfer_steps = pan_steps_until(
            migration.pan_transfer_method, "cutover"
        )
        await save_fixture(migration)

        response = await client.get(f"/v1/merchant-migrations/{migration.id}/cutover")
        assert response.status_code == 200
        body = response.json()
        assert body["started"] is False
        assert body["running"] is False
        assert body["total"] == 0


@pytest.mark.asyncio
class TestExportCustomerIds:
    async def test_anonymous(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/customer-ids.csv"
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_exports_imported_customer_ids_only(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        records = (
            (
                MerchantMigrationRecordType.customer,
                MerchantMigrationRecordStatus.imported,
                "cus_second",
            ),
            (
                MerchantMigrationRecordType.customer,
                MerchantMigrationRecordStatus.imported,
                "cus_first",
            ),
            (
                MerchantMigrationRecordType.customer,
                MerchantMigrationRecordStatus.pending,
                "cus_pending",
            ),
            (
                MerchantMigrationRecordType.subscription,
                MerchantMigrationRecordStatus.imported,
                "sub_imported",
            ),
        )
        for type, status, source_id in records:
            await save_fixture(
                MerchantMigrationRecord(
                    merchant_migration=migration,
                    organization=organization,
                    type=type,
                    status=status,
                    source_id=source_id,
                    canonical={},
                )
            )

        response = await client.get(
            f"/v1/merchant-migrations/{migration.id}/customer-ids.csv"
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert (
            response.headers["content-disposition"]
            == 'attachment; filename="stripe-customer-ids.csv"'
        )
        assert response.text == "cus_second\r\ncus_first\r\n"


@pytest.mark.asyncio
class TestUpdateRecord:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_foreign_record_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        other = await _create_migration(save_fixture, organization)
        record = MerchantMigrationRecord(
            merchant_migration=other,
            organization=organization,
            type=MerchantMigrationRecordType.subscription,
            status=MerchantMigrationRecordStatus.pending,
            source_id="sub_1",
            canonical=serialize(canonical_subscription()),
        )
        await save_fixture(record)
        response = await client.patch(
            f"/v1/merchant-migrations/{migration.id}/records/{record.id}",
            json={"tax_behavior": "exclusive"},
        )
        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    @pytest.mark.parametrize(
        ("kind", "expected"),
        [("subscription", 200), ("moved", 409), ("customer", 400)],
    )
    async def test_patches_tax(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        kind: str,
        expected: int,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        subscription = kind != "customer"
        record = MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=(
                MerchantMigrationRecordType.subscription
                if subscription
                else MerchantMigrationRecordType.customer
            ),
            status=(
                MerchantMigrationRecordStatus.imported
                if kind == "moved"
                else MerchantMigrationRecordStatus.pending
            ),
            source_id="sub_1" if subscription else "cus_1",
            cutover_status=(
                MerchantMigrationCutoverStatus.moved if kind == "moved" else None
            ),
            canonical=serialize(canonical_subscription()) if subscription else {},
        )
        await save_fixture(record)
        response = await client.patch(
            f"/v1/merchant-migrations/{migration.id}/records/{record.id}",
            json={"tax_behavior": "exclusive"},
        )
        assert response.status_code == expected
        if expected != 200:
            return
        assert response.json()["tax_behavior"] == "exclusive"
        reloaded = await MerchantMigrationRecordRepository.from_session(
            session
        ).get_by_id(record.id)
        assert reloaded is not None
        assert reloaded.canonical["tax_behavior"] == "exclusive"


@pytest.mark.asyncio
class TestUpdateBillingAddress:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.organizations_write}))
    async def test_updates_staged_customer(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        customer = MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.customer,
            source_id="cus_1",
            canonical=serialize(
                CanonicalCustomer(
                    source_id="cus_1",
                    email="customer@example.com",
                    name="Customer",
                    country=None,
                    country_hint="DE",
                )
            ),
        )
        subscription = MerchantMigrationRecord(
            merchant_migration=migration,
            organization=organization,
            type=MerchantMigrationRecordType.subscription,
            source_id="sub_1",
            canonical=serialize(canonical_subscription()),
        )
        await save_fixture(customer)
        await save_fixture(subscription)

        billing_address = {
            "line1": "123 Main Street",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "US",
        }
        response = await client.patch(
            f"/v1/merchant-migrations/{migration.id}/records/{subscription.id}",
            json={"billing_address": billing_address},
        )

        assert response.status_code == 200
        saved_address = response.json()["billing_address"]
        assert saved_address["state"] == "US-NY"
        reloaded = await MerchantMigrationRecordRepository.from_session(
            session
        ).get_by_id(customer.id)
        assert reloaded is not None
        assert reloaded.canonical["country"] == "US"
        assert reloaded.canonical["country_hint"] is None
        assert reloaded.canonical["billing_address"] == saved_address


async def _create_migration(
    save_fixture: SaveFixture,
    organization: Organization,
    step: MerchantMigrationStep = MerchantMigrationStep.source_setup,
) -> MerchantMigration:
    migration = MerchantMigration(
        organization_id=organization.id,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=step,
    )
    await save_fixture(migration)
    return migration
