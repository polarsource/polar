import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from polar.auth.dependencies import AuthMethod
from polar.authz.service import Anonymous, Authz
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.models import (
    Account,
    Organization,
    SubscriptionTier,
    User,
)
from polar.postgres import AsyncSession
from polar.subscription.service.subscribe_session import (
    AlreadySubscribed,
    ArchivedSubscriptionTier,
    FreeSubscriptionTier,
    NoAssociatedPayoutAccount,
    NotAddedToStripeSubscriptionTier,
)
from polar.subscription.service.subscribe_session import (
    subscribe_session as subscribe_session_service,
)

from ..conftest import (
    add_subscription_benefits,
    create_active_subscription,
    create_subscription_benefit,
)


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestCreateSubscribeSession:
    async def test_free_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        with pytest.raises(FreeSubscriptionTier):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization_free,
                "SUCCESS_URL",
                Anonymous(),
                None,
                authz,
            )

    async def test_archived_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        subscription_tier_organization.is_archived = True

        with pytest.raises(ArchivedSubscriptionTier):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
                authz,
            )

    async def test_not_added_to_stripe_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        subscription_tier_organization.stripe_product_id = None
        subscription_tier_organization.stripe_price_id = None

        with pytest.raises(NotAddedToStripeSubscriptionTier):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
                authz,
            )

    async def test_no_associated_payout_account_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        with pytest.raises(NoAssociatedPayoutAccount):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
                authz,
            )

    async def test_already_subscribed(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        organization_account: Account,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            session, subscription_tier=subscription_tier_organization, user=user
        )

        with pytest.raises(AlreadySubscribed):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                user,
                AuthMethod.COOKIE,
                authz,
            )

    async def test_valid_anonymous(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        organization_account: Account,
    ) -> None:
        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            Anonymous(),
            None,
            authz,
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email is None
        assert subscribe_session.customer_name is None
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id)
            },
        )

    async def test_valid_user_cookie(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.COOKIE,
            authz,
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email == "backer@example.com"
        assert subscribe_session.customer_name == "John"
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            customer="STRIPE_CUSTOMER_ID",
            metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "user_id": str(user.id),
            },
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "user_id": str(user.id),
            },
        )

    async def test_valid_pat(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.PERSONAL_ACCESS_TOKEN,
            authz,
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email is None
        assert subscribe_session.customer_name is None
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id)
            },
        )

    async def test_valid_pat_customer_email(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email="backer@example.com",
            customer_details=None,
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.PERSONAL_ACCESS_TOKEN,
            authz,
            customer_email="backer@example.com",
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email == "backer@example.com"
        assert subscribe_session.customer_name is None
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            customer_email="backer@example.com",
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id)
            },
        )

    async def test_valid_tax_applicable(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        organization: Organization,
        user: User,
        organization_account: Account,
    ) -> None:
        applicable_tax_benefit = await create_subscription_benefit(
            session, is_tax_applicable=True, organization=organization
        )
        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=[applicable_tax_benefit],
        )

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            Anonymous(),
            None,
            authz,
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email is None
        assert subscribe_session.customer_name is None
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=True,
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id)
            },
        )

    async def test_valid_free_subscription_upgrade(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_free: SubscriptionTier,
        stripe_service_mock: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        free_subscription = await create_active_subscription(
            session, subscription_tier=subscription_tier_organization_free, user=user
        )

        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.COOKIE,
            authz,
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            customer="STRIPE_CUSTOMER_ID",
            metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "subscription_id": str(free_subscription.id),
                "user_id": str(user.id),
            },
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "subscription_id": str(free_subscription.id),
                "user_id": str(user.id),
            },
        )

    async def test_organization_anonymous(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        organization_subscriber: Organization,
        organization_account: Account,
    ) -> None:
        with pytest.raises(Unauthorized):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
                authz,
                organization_id=organization_subscriber.id,
            )

    async def test_organization_not_admin(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        organization_subscriber: Organization,
        user: User,
        organization_account: Account,
    ) -> None:
        with pytest.raises(NotPermitted):
            await subscribe_session_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                user,
                AuthMethod.COOKIE,
                authz,
                organization_id=organization_subscriber.id,
            )

    async def test_organization_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
        organization_subscriber: Organization,
        organization_subscriber_admin: User,
        organization_account: Account,
    ) -> None:
        organization_subscriber.stripe_customer_id = "ORGANIZATION_STRIPE_CUSTOMER_ID"
        organization_subscriber_admin.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "Organization", "email": "backer@example.com"},
            metadata={"organization_subscriber_id": str(organization_subscriber.id)},
        )

        subscribe_session = await subscribe_session_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            organization_subscriber_admin,
            AuthMethod.COOKIE,
            authz,
            organization_id=organization_subscriber.id,
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email == "backer@example.com"
        assert subscribe_session.customer_name == "Organization"
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )

        create_subscription_checkout_session_mock.assert_called_once_with(
            subscription_tier_organization.stripe_price_id,
            "SUCCESS_URL",
            is_tax_applicable=False,
            customer="ORGANIZATION_STRIPE_CUSTOMER_ID",
            metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "organization_subscriber_id": str(organization_subscriber.id),
                "user_id": str(organization_subscriber_admin.id),
            },
            subscription_metadata={
                "subscription_tier_id": str(subscription_tier_organization.id),
                "organization_subscriber_id": str(organization_subscriber.id),
                "user_id": str(organization_subscriber_admin.id),
            },
        )


@pytest.mark.asyncio
class TestGetSubscribeSession:
    @pytest.mark.parametrize(
        "metadata", [None, {}, {"subscription_tier_id": str(uuid.uuid4())}]
    )
    async def test_invalid(
        self,
        metadata: dict[str, str] | None,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata=metadata,
        )

        with pytest.raises(ResourceNotFound):
            await subscribe_session_service.get_subscribe_session(session, "SESSION_ID")

    async def test_valid(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        subscribe_session = await subscribe_session_service.get_subscribe_session(
            session, "SESSION_ID"
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email == "backer@example.com"
        assert subscribe_session.customer_name == "John"
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )
