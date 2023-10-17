import uuid

import pytest

from polar.authz.service import Anonymous, Authz
from polar.kit.pagination import PaginationParams
from polar.models import (
    Organization,
    Repository,
    SubscriptionGroup,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionGroupInitialize
from polar.subscription.service.subscription_group import (
    DEFAULT_SUBSCRIPTION_GROUPS,
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
    SubscriptionGroupsAlreadyInitialized,
)
from polar.subscription.service.subscription_group import (
    subscription_group as subscription_group_service,
)

from ..conftest import create_subscription_group


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_anonymous(
        self, session: AsyncSession, subscription_groups: list[SubscriptionGroup]
    ) -> None:
        results, count = await subscription_group_service.search(
            session, Anonymous(), pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == subscription_groups[0].id
        assert results[1].id == subscription_groups[1].id

    async def test_user(
        self,
        session: AsyncSession,
        subscription_groups: list[SubscriptionGroup],
        user: User,
    ) -> None:
        results, count = await subscription_group_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == subscription_groups[0].id
        assert results[1].id == subscription_groups[1].id

    async def test_user_organization(
        self,
        session: AsyncSession,
        user: User,
        subscription_groups: list[SubscriptionGroup],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_group_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 3
        assert len(results) == 3

    async def test_filter_organization_direct(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_groups: list[SubscriptionGroup],
        subscription_group_organization: SubscriptionGroup,
    ) -> None:
        results, count = await subscription_group_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_group_organization.id

    async def test_filter_organization_indirect(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_groups: list[SubscriptionGroup],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_group_service.search(
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
        subscription_groups: list[SubscriptionGroup],
        subscription_group_private_repository: SubscriptionGroup,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_group_service.search(
            session, user, repository=repository, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_group_private_repository.id


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
class TestInitialize:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionGroupInitialize(organization_id=uuid.uuid4())
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_group_service.initialize(
                session, authz, create_schema, user
            )

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user: User,
    ) -> None:
        create_schema = SubscriptionGroupInitialize(organization_id=organization.id)
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_group_service.initialize(
                session, authz, create_schema, user
            )

    async def test_initialized_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user: User,
        user_organization_admin: UserOrganization,
    ) -> None:
        await create_subscription_group(session, organization=organization)

        create_schema = SubscriptionGroupInitialize(organization_id=organization.id)
        with pytest.raises(SubscriptionGroupsAlreadyInitialized):
            await subscription_group_service.initialize(
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
        create_schema = SubscriptionGroupInitialize(organization_id=organization.id)
        subscription_groups = await subscription_group_service.initialize(
            session, authz, create_schema, user
        )

        assert len(subscription_groups) == len(DEFAULT_SUBSCRIPTION_GROUPS)
        for subscription_group in subscription_groups:
            assert subscription_group.organization_id == organization.id

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionGroupInitialize(repository_id=uuid.uuid4())
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_group_service.initialize(
                session, authz, create_schema, user
            )

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        public_repository: Repository,
        user: User,
    ) -> None:
        create_schema = SubscriptionGroupInitialize(repository_id=public_repository.id)
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_group_service.initialize(
                session, authz, create_schema, user
            )

    async def test_initialized_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        public_repository: Repository,
        user: User,
        user_organization_admin: UserOrganization,
    ) -> None:
        await create_subscription_group(session, repository=public_repository)

        create_schema = SubscriptionGroupInitialize(repository_id=public_repository.id)
        with pytest.raises(SubscriptionGroupsAlreadyInitialized):
            await subscription_group_service.initialize(
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
        create_schema = SubscriptionGroupInitialize(repository_id=public_repository.id)
        subscription_groups = await subscription_group_service.initialize(
            session, authz, create_schema, user
        )

        assert len(subscription_groups) == len(DEFAULT_SUBSCRIPTION_GROUPS)
        for subscription_group in subscription_groups:
            assert subscription_group.repository_id == public_repository.id
