import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from polar.auth.dependencies import AuthMethod
from polar.authz.service import Anonymous, Authz
from polar.exceptions import NotPermitted
from polar.integrations.stripe.service import StripeError
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Organization,
    Repository,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionTierCreate, SubscriptionTierUpdate
from polar.subscription.service.subscription_tier import (
    ArchivedSubscriptionTier,
    NoAssociatedPayoutAccount,
    NotAddedToStripeSubscriptionTier,
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
)
from polar.subscription.service.subscription_tier import (
    subscription_tier as subscription_tier_service,
)


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_anonymous(
        self, session: AsyncSession, subscription_tiers: list[SubscriptionTier]
    ) -> None:
        results, count = await subscription_tier_service.search(
            session, Anonymous(), pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == subscription_tiers[0].id
        assert results[1].id == subscription_tiers[1].id

    async def test_user(
        self,
        session: AsyncSession,
        subscription_tiers: list[SubscriptionTier],
        user: User,
    ) -> None:
        results, count = await subscription_tier_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == subscription_tiers[0].id
        assert results[1].id == subscription_tiers[1].id

    async def test_user_organization(
        self,
        session: AsyncSession,
        user: User,
        subscription_tiers: list[SubscriptionTier],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_tier_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 3
        assert len(results) == 3

    async def test_filter_organization_direct(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        results, count = await subscription_tier_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_tier_organization.id

    async def test_filter_organization_indirect(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_tier_service.search(
            session,
            user,
            organization=organization,
            direct_organization=False,
            pagination=PaginationParams(1, 10),
        )

        assert count == 3
        assert len(results) == 3

    async def test_filter_repository(
        self,
        session: AsyncSession,
        user: User,
        repository: Repository,
        subscription_tiers: list[SubscriptionTier],
        subscription_tier_private_repository: SubscriptionTier,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_tier_service.search(
            session, user, repository=repository, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_tier_private_repository.id


@pytest.mark.asyncio
class TestGetById:
    async def test_anonymous(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        not_accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), subscription_tier_private_repository.id
        )
        assert not_accessible_subscription_tier is None

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id

    async def test_user(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        not_accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_private_repository.id
        )
        assert not_accessible_subscription_tier is None

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id

    async def test_user_organization(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        private_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_private_repository.id
        )
        assert private_subscription_tier is not None
        assert private_subscription_tier.id == subscription_tier_private_repository.id

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=uuid.uuid4(),
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        create_product_with_price_mock: MagicMock = (
            mock_stripe_service.create_product_with_price
        )
        create_product_with_price_mock.return_value = SimpleNamespace(
            stripe_id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )
        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.organization_id == organization.id

        create_product_with_price_mock.assert_called_once()
        assert subscription_tier.stripe_product_id == "PRODUCT_ID"
        assert subscription_tier.stripe_price_id == "PRICE_ID"

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=uuid.uuid4(),
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=repository.id,
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        create_product_with_price_mock: MagicMock = (
            mock_stripe_service.create_product_with_price
        )
        create_product_with_price_mock.return_value = SimpleNamespace(
            stripe_id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=repository.id,
        )
        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.repository_id == repository.id

        create_product_with_price_mock.assert_called_once()
        assert subscription_tier.stripe_product_id == "PRODUCT_ID"
        assert subscription_tier.stripe_price_id == "PRICE_ID"

    async def test_stripe_error(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        create_product_with_price_mock: MagicMock = (
            mock_stripe_service.create_product_with_price
        )
        create_product_with_price_mock.side_effect = StripeError()

        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )

        with pytest.raises(StripeError):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

        subscription_tier = await SubscriptionTier.find_by(
            session, name="Subscription Tier"
        )
        assert subscription_tier is None


@pytest.mark.asyncio
class TestUserUpdate:
    async def test_not_writable_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        update_schema = SubscriptionTierUpdate(name="Subscription Tier Update")
        with pytest.raises(NotPermitted):
            await subscription_tier_service.user_update(
                session, authz, subscription_tier_organization, update_schema, user
            )

    async def test_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        update_schema = SubscriptionTierUpdate(name="Subscription Tier Update")
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization, update_schema, user
        )
        assert updated_subscription_tier.name == "Subscription Tier Update"

    async def test_valid_price_change(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        create_price_for_product_mock: MagicMock = (
            mock_stripe_service.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(
            stripe_id="NEW_PRICE_ID"
        )
        archive_price_mock: MagicMock = mock_stripe_service.archive_price

        old_price_id = subscription_tier_organization.stripe_price_id

        update_schema = SubscriptionTierUpdate(price_amount=1500)
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization, update_schema, user
        )

        create_price_for_product_mock.assert_called_once()
        archive_price_mock.assert_called_once_with(old_price_id)

        assert updated_subscription_tier.price_amount == 1500
        assert updated_subscription_tier.stripe_price_id == "NEW_PRICE_ID"


@pytest.mark.asyncio
class TestArchive:
    async def test_not_writable_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        with pytest.raises(NotPermitted):
            await subscription_tier_service.archive(
                session, authz, subscription_tier_organization, user
            )

    async def test_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        archive_product_mock: MagicMock = mock_stripe_service.archive_product

        updated_subscription_tier = await subscription_tier_service.archive(
            session, authz, subscription_tier_organization, user
        )

        archive_product_mock.assert_called_once_with(
            subscription_tier_organization.stripe_product_id
        )

        assert updated_subscription_tier.is_archived


@pytest.mark.asyncio
class TestCreateSubscribeSession:
    async def test_archived_subscription_tier(
        self, session: AsyncSession, subscription_tier_organization: SubscriptionTier
    ) -> None:
        subscription_tier_organization.is_archived = True

        with pytest.raises(ArchivedSubscriptionTier):
            await subscription_tier_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
            )

    async def test_not_added_to_stripe_subscription_tier(
        self, session: AsyncSession, subscription_tier_organization: SubscriptionTier
    ) -> None:
        subscription_tier_organization.stripe_product_id = None
        subscription_tier_organization.stripe_price_id = None

        with pytest.raises(NotAddedToStripeSubscriptionTier):
            await subscription_tier_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
            )

    async def test_no_associated_payout_account_subscription_tier(
        self, session: AsyncSession, subscription_tier_organization: SubscriptionTier
    ) -> None:
        with pytest.raises(NoAssociatedPayoutAccount):
            await subscription_tier_service.create_subscribe_session(
                session,
                subscription_tier_organization,
                "SUCCESS_URL",
                Anonymous(),
                None,
            )

    async def test_valid_anonymous(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
        organization_account: Account,
    ) -> None:
        create_subscription_checkout_session_mock: MagicMock = (
            mock_stripe_service.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
        )

        subscribe_session = await subscription_tier_service.create_subscribe_session(
            session, subscription_tier_organization, "SUCCESS_URL", Anonymous(), None
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
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

    async def test_valid_user_cookie(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: MagicMock = (
            mock_stripe_service.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
        )

        subscribe_session = await subscription_tier_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.COOKIE,
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
            customer="STRIPE_CUSTOMER_ID",
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

    async def test_valid_pat(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: MagicMock = (
            mock_stripe_service.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
        )

        subscribe_session = await subscription_tier_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.PERSONAL_ACCESS_TOKEN,
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
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

    async def test_valid_pat_customer_email(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
        user: User,
        organization_account: Account,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_subscription_checkout_session_mock: MagicMock = (
            mock_stripe_service.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email="backer@example.com",
            customer_details=None,
        )

        subscribe_session = await subscription_tier_service.create_subscribe_session(
            session,
            subscription_tier_organization,
            "SUCCESS_URL",
            user,
            AuthMethod.PERSONAL_ACCESS_TOKEN,
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
            customer_email="backer@example.com",
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )


@pytest.mark.asyncio
class TestGetSubscribeSession:
    async def test_valid(
        self,
        session: AsyncSession,
        mock_stripe_service: MagicMock,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        get_checkout_session_mock: MagicMock = mock_stripe_service.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        subscribe_session = await subscription_tier_service.get_subscribe_session(
            session, "SESSION_ID"
        )

        assert subscribe_session.id == "SESSION_ID"
        assert subscribe_session.url == "STRIPE_URL"
        assert subscribe_session.customer_email == "backer@example.com"
        assert subscribe_session.customer_name == "John"
        assert (
            subscribe_session.subscription_tier.id == subscription_tier_organization.id
        )
