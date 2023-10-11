import uuid

import pytest

from polar.authz.service import Authz
from polar.exceptions import NotPermitted
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
    ) -> None:
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
    ) -> None:
        updated_subscription_tier = await subscription_tier_service.archive(
            session, authz, subscription_tier_organization, user
        )
        assert updated_subscription_tier.is_archived
