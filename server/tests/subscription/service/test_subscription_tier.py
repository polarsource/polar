import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from polar.authz.service import Authz
from polar.exceptions import NotPermitted
from polar.integrations.stripe.service import StripeError
from polar.models import SubscriptionGroup, SubscriptionTier, User, UserOrganization
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionTierCreate, SubscriptionTierUpdate
from polar.subscription.service.subscription_tier import SubscriptionGroupDoesNotExist
from polar.subscription.service.subscription_tier import (
    subscription_tier as subscription_tier_service,
)


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_subscription_group(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            subscription_group_id=uuid.uuid4(),
        )
        with pytest.raises(SubscriptionGroupDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_subscription_group(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_group_organization: SubscriptionGroup,
    ) -> None:
        create_schema = SubscriptionTierCreate(
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            subscription_group_id=subscription_group_organization.id,
        )
        with pytest.raises(SubscriptionGroupDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_group_organization: SubscriptionGroup,
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
            subscription_group_id=subscription_group_organization.id,
        )
        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert (
            subscription_tier.subscription_group_id
            == subscription_group_organization.id
        )

        create_product_with_price_mock.assert_called_once()
        assert subscription_tier.stripe_product_id == "PRODUCT_ID"
        assert subscription_tier.stripe_price_id == "PRICE_ID"

    async def test_stripe_error(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_group_organization: SubscriptionGroup,
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
            subscription_group_id=subscription_group_organization.id,
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
