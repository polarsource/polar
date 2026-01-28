"""Tests for Stripe v1 and v2 account creation and handling."""

import uuid
from unittest.mock import AsyncMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.integrations.stripe.service import (
    STRIPE_API_VERSION_V1,
    STRIPE_API_VERSION_V2,
    stripe,
)
from polar.integrations.stripe.tasks import (
    account_updated,
    v2_account_capability_status_updated,
    v2_account_updated,
)
from polar.models import Account, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def build_stripe_account(
    *,
    id: str = "acct_test123",
    email: str = "test@example.com",
    country: str = "US",
    default_currency: str = "usd",
    details_submitted: bool = True,
    charges_enabled: bool = True,
    payouts_enabled: bool = True,
    business_type: str = "company",
    capabilities: dict[str, str] | None = None,
) -> stripe_lib.Account:
    """Build a mock Stripe account for testing."""
    if capabilities is None:
        capabilities = {"transfers": "active"}

    return stripe_lib.Account.construct_from(
        {
            "id": id,
            "object": "account",
            "email": email,
            "country": country,
            "default_currency": default_currency,
            "details_submitted": details_submitted,
            "charges_enabled": charges_enabled,
            "payouts_enabled": payouts_enabled,
            "business_type": business_type,
            "capabilities": capabilities,
        },
        stripe_lib.api_key,
    )


async def create_account_with_version(
    save_fixture: SaveFixture,
    *,
    admin: User,
    stripe_id: str = "acct_test123",
    api_version: int | None = None,
    status: Account.Status = Account.Status.ACTIVE,
) -> Account:
    """Create an account with a specific Stripe API version."""
    account = Account(
        account_type=AccountType.stripe,
        status=status,
        admin_id=admin.id,
        stripe_id=stripe_id,
        stripe_api_version=api_version,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    await save_fixture(account)
    return account


class FakeAccountCreateForOrganization:
    """Fake schema for testing account creation."""

    def __init__(self, country: str = "US", account_type: AccountType = AccountType.stripe):
        self.country = country
        self.account_type = account_type


@pytest.mark.asyncio
class TestStripeAccountCreation:
    """Test Stripe account creation for v1 and v2 APIs."""

    async def test_create_account_v1_default(
        self, mocker: MockerFixture
    ) -> None:
        """Test that v1 account creation is used by default."""
        # Mock the v1 API call
        mock_create = mocker.patch.object(
            stripe_lib.Account, "create_async", new_callable=AsyncMock
        )
        mock_create.return_value = build_stripe_account(id="acct_v1_test")

        # Ensure feature flag is off
        mocker.patch(
            "polar.integrations.stripe.service.settings.STRIPE_USE_V2_ACCOUNTS",
            False,
        )

        account_create = FakeAccountCreateForOrganization(country="US")
        stripe_account, api_version = await stripe.create_account(account_create, None)

        assert api_version == STRIPE_API_VERSION_V1
        assert stripe_account.id == "acct_v1_test"

        # Verify v1 params were used
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["type"] == "express"
        assert call_kwargs["capabilities"] == {"transfers": {"requested": True}}

    async def test_create_account_v2_with_feature_flag(
        self, mocker: MockerFixture
    ) -> None:
        """Test that v2 account creation is used when feature flag is enabled."""
        mock_create = mocker.patch.object(
            stripe_lib.Account, "create_async", new_callable=AsyncMock
        )
        mock_create.return_value = build_stripe_account(id="acct_v2_test")

        # Enable v2 feature flag
        mocker.patch(
            "polar.integrations.stripe.service.settings.STRIPE_USE_V2_ACCOUNTS",
            True,
        )

        account_create = FakeAccountCreateForOrganization(country="US")
        stripe_account, api_version = await stripe.create_account(account_create, None)

        assert api_version == STRIPE_API_VERSION_V2
        assert stripe_account.id == "acct_v2_test"

        # Verify v2 params include controller configuration
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["type"] == "express"
        assert "controller" in call_kwargs
        assert call_kwargs["controller"]["stripe_dashboard"]["type"] == "express"

    async def test_create_account_v1_non_us(
        self, mocker: MockerFixture
    ) -> None:
        """Test that non-US v1 accounts include TOS acceptance."""
        mock_create = mocker.patch.object(
            stripe_lib.Account, "create_async", new_callable=AsyncMock
        )
        mock_create.return_value = build_stripe_account(id="acct_eu_test", country="DE")

        mocker.patch(
            "polar.integrations.stripe.service.settings.STRIPE_USE_V2_ACCOUNTS",
            False,
        )

        account_create = FakeAccountCreateForOrganization(country="DE")
        stripe_account, api_version = await stripe.create_account(account_create, None)

        assert api_version == STRIPE_API_VERSION_V1

        # Verify TOS acceptance for non-US accounts
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["tos_acceptance"] == {"service_agreement": "recipient"}

    async def test_create_account_v2_non_us(
        self, mocker: MockerFixture
    ) -> None:
        """Test that non-US v2 accounts include TOS acceptance."""
        mock_create = mocker.patch.object(
            stripe_lib.Account, "create_async", new_callable=AsyncMock
        )
        mock_create.return_value = build_stripe_account(id="acct_eu_v2_test", country="DE")

        mocker.patch(
            "polar.integrations.stripe.service.settings.STRIPE_USE_V2_ACCOUNTS",
            True,
        )

        account_create = FakeAccountCreateForOrganization(country="DE")
        stripe_account, api_version = await stripe.create_account(account_create, None)

        assert api_version == STRIPE_API_VERSION_V2

        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["tos_acceptance"] == {"service_agreement": "recipient"}


@pytest.mark.asyncio
class TestStripeTransfersStatus:
    """Test capability status checking for v1 and v2 accounts."""

    async def test_get_transfers_status_v1_active(self) -> None:
        """Test getting transfers status from v1 account."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "active"}
        )

        status = stripe.get_transfers_status(stripe_account, STRIPE_API_VERSION_V1)
        assert status == "active"

    async def test_get_transfers_status_v1_inactive(self) -> None:
        """Test getting inactive transfers status from v1 account."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "inactive"}
        )

        status = stripe.get_transfers_status(stripe_account, STRIPE_API_VERSION_V1)
        assert status == "inactive"

    async def test_get_transfers_status_v2_active(self) -> None:
        """Test getting transfers status from v2 account."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "active"}
        )

        status = stripe.get_transfers_status(stripe_account, STRIPE_API_VERSION_V2)
        assert status == "active"

    async def test_get_transfers_status_none_for_legacy(self) -> None:
        """Test getting transfers status when api_version is None (legacy)."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "active"}
        )

        status = stripe.get_transfers_status(stripe_account, None)
        assert status == "active"

    async def test_is_transfers_enabled_active(self) -> None:
        """Test is_transfers_enabled returns True for active status."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "active"}
        )

        assert stripe.is_transfers_enabled(stripe_account, STRIPE_API_VERSION_V1) is True

    async def test_is_transfers_enabled_inactive(self) -> None:
        """Test is_transfers_enabled returns False for inactive status."""
        stripe_account = build_stripe_account(
            capabilities={"transfers": "inactive"}
        )

        assert stripe.is_transfers_enabled(stripe_account, STRIPE_API_VERSION_V1) is False


@pytest.mark.asyncio
class TestAccountServiceWithVersions:
    """Test AccountService handling of v1 and v2 accounts."""

    async def test_update_account_from_stripe_preserves_version(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        """Test that updating account from Stripe preserves API version."""
        # Create a v2 account
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_v2_update",
            api_version=STRIPE_API_VERSION_V2,
        )

        # Build updated Stripe account
        stripe_account = build_stripe_account(
            id="acct_v2_update",
            charges_enabled=True,
            payouts_enabled=True,
        )

        # Mock organization service to avoid side effects
        mocker.patch(
            "polar.account.service.organization_service.update_status_from_stripe_account",
            new_callable=AsyncMock,
        )

        updated = await account_service.update_account_from_stripe(
            session, stripe_account=stripe_account
        )

        # API version should be preserved
        assert updated.stripe_api_version == STRIPE_API_VERSION_V2


@pytest.mark.asyncio
class TestWebhookHandlers:
    """Test webhook handlers for v1 and v2 events."""

    async def test_v1_account_updated_webhook(
        self, mocker: MockerFixture, save_fixture: SaveFixture, user: User
    ) -> None:
        """Test v1 account.updated webhook handler."""
        # Create account
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_webhook_v1",
            api_version=STRIPE_API_VERSION_V1,
        )

        stripe_account = build_stripe_account(
            id="acct_webhook_v1",
            charges_enabled=True,
            payouts_enabled=True,
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = stripe_account

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        update_mock = mocker.patch(
            "polar.integrations.stripe.tasks.account_service.update_account_from_stripe",
            new_callable=AsyncMock,
        )

        event_id = uuid.uuid4()
        await account_updated(event_id)

        update_mock.assert_called_once()

    async def test_v2_capability_status_updated_webhook(
        self, mocker: MockerFixture, save_fixture: SaveFixture, user: User
    ) -> None:
        """Test v2 capability_status_updated webhook handler."""
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_webhook_v2",
            api_version=STRIPE_API_VERSION_V2,
        )

        stripe_account = build_stripe_account(
            id="acct_webhook_v2",
            charges_enabled=True,
            payouts_enabled=True,
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = stripe_account

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        update_mock = mocker.patch(
            "polar.integrations.stripe.tasks.account_service.update_account_from_stripe",
            new_callable=AsyncMock,
        )

        event_id = uuid.uuid4()
        await v2_account_capability_status_updated(event_id)

        update_mock.assert_called_once()

    async def test_v2_account_updated_webhook(
        self, mocker: MockerFixture, save_fixture: SaveFixture, user: User
    ) -> None:
        """Test v2 account.updated webhook handler."""
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_webhook_v2_update",
            api_version=STRIPE_API_VERSION_V2,
        )

        stripe_account = build_stripe_account(
            id="acct_webhook_v2_update",
            charges_enabled=True,
            payouts_enabled=True,
        )

        event_mock = mocker.MagicMock()
        event_mock.stripe_data.data.object = stripe_account

        context_mock = mocker.patch(
            "polar.integrations.stripe.tasks.external_event_service.handle_stripe"
        )
        context_mock.return_value.__aenter__ = AsyncMock(return_value=event_mock)
        context_mock.return_value.__aexit__ = AsyncMock(return_value=None)

        update_mock = mocker.patch(
            "polar.integrations.stripe.tasks.account_service.update_account_from_stripe",
            new_callable=AsyncMock,
        )

        event_id = uuid.uuid4()
        await v2_account_updated(event_id)

        update_mock.assert_called_once()


@pytest.mark.asyncio
class TestBackwardCompatibility:
    """Test backward compatibility with existing v1 accounts."""

    async def test_legacy_account_without_version_treated_as_v1(
        self, save_fixture: SaveFixture, user: User
    ) -> None:
        """Test that accounts without stripe_api_version are treated as v1."""
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_legacy",
            api_version=None,  # Legacy account
        )

        # Should work with None version (treated as v1)
        stripe_account = build_stripe_account(id="acct_legacy")
        status = stripe.get_transfers_status(stripe_account, account.stripe_api_version)
        assert status == "active"

    async def test_existing_v1_accounts_continue_to_work(
        self, save_fixture: SaveFixture, user: User
    ) -> None:
        """Test that existing v1 accounts continue to work."""
        account = await create_account_with_version(
            save_fixture,
            admin=user,
            stripe_id="acct_existing_v1",
            api_version=STRIPE_API_VERSION_V1,
        )

        assert account.stripe_api_version == STRIPE_API_VERSION_V1
        assert account.stripe_id == "acct_existing_v1"

        stripe_account = build_stripe_account(id="acct_existing_v1")
        assert stripe.is_transfers_enabled(stripe_account, account.stripe_api_version)
