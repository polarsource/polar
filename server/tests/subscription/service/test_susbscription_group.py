import uuid

import pytest

from polar.authz.service import Authz
from polar.models import (
    Organization,
    Repository,
    SubscriptionGroup,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionGroupCreate
from polar.subscription.service.subscription_group import (
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
)
from polar.subscription.service.subscription_group import (
    subscription_group as subscription_group_service,
)


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
async def test_with_organization_or_repository(
    session: AsyncSession,
    subscription_group_organization: SubscriptionGroup,
    subscription_group_repository: SubscriptionGroup,
) -> None:
    subscription_group = (
        await subscription_group_service.get_with_organization_or_repository(
            session, subscription_group_organization.id
        )
    )
    assert subscription_group is not None
    assert subscription_group.organization is not None
    assert (
        subscription_group.organization.id
        == subscription_group_organization.organization_id
    )

    subscription_group = (
        await subscription_group_service.get_with_organization_or_repository(
            session, subscription_group_repository.id
        )
    )
    assert subscription_group is not None
    assert subscription_group.repository is not None
    assert (
        subscription_group.repository.id == subscription_group_repository.repository_id
    )


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            organization_id=uuid.uuid4(),
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_group_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user: User,
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            organization_id=organization.id,
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_group_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user: User,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            organization_id=organization.id,
        )
        subscription_group = await subscription_group_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_group.organization_id == organization.id

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            repository_id=uuid.uuid4(),
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_group_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        public_repository: Repository,
        user: User,
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            repository_id=public_repository.id,
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_group_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        public_repository: Repository,
        user: User,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = SubscriptionGroupCreate(
            name="Subscription Group",
            order=1,
            repository_id=public_repository.id,
        )
        subscription_group = await subscription_group_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_group.repository_id == public_repository.id
