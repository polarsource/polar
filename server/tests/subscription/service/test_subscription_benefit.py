import uuid

import pytest

from polar.authz.service import Authz
from polar.exceptions import NotPermitted
from polar.kit.pagination import PaginationParams
from polar.models import (
    Organization,
    Repository,
    SubscriptionBenefit,
    User,
    UserOrganization,
)
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.postgres import AsyncSession
from polar.subscription.schemas import (
    SubscriptionBenefitCreate,
    SubscriptionBenefitUpdate,
)
from polar.subscription.service.subscription_benefit import (
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
)
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)

from ..conftest import create_subscription_benefit


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_user(
        self,
        session: AsyncSession,
        subscription_benefits: list[SubscriptionBenefit],
        user: User,
    ) -> None:
        results, count = await subscription_benefit_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(results) == 0

    async def test_user_organization(
        self,
        session: AsyncSession,
        user: User,
        subscription_benefits: list[SubscriptionBenefit],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_benefit_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == len(subscription_benefits)
        assert len(results) == len(subscription_benefits)

    async def test_filter_type(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        plain_subscription_benefit = await create_subscription_benefit(
            session, type=SubscriptionBenefitType.plain, organization=organization
        )
        results, count = await subscription_benefit_service.search(
            session,
            user,
            type=SubscriptionBenefitType.plain,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == plain_subscription_benefit.id

    async def test_filter_organization_direct(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_benefits: list[SubscriptionBenefit],
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_benefit_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_benefit_organization.id

    async def test_filter_organization_indirect(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_benefits: list[SubscriptionBenefit],
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_benefit_service.search(
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
        subscription_benefits: list[SubscriptionBenefit],
        subscription_benefit_private_repository: SubscriptionBenefit,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await subscription_benefit_service.search(
            session, user, repository=repository, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_benefit_private_repository.id


@pytest.mark.asyncio
class TestGetById:
    async def test_user(
        self,
        session: AsyncSession,
        subscription_benefit_private_repository: SubscriptionBenefit,
        subscription_benefit_organization: SubscriptionBenefit,
        user: User,
    ) -> None:
        not_existing_subscription_benefit = (
            await subscription_benefit_service.get_by_id(session, user, uuid.uuid4())
        )
        assert not_existing_subscription_benefit is None

        private_subscription_benefit = await subscription_benefit_service.get_by_id(
            session, user, subscription_benefit_private_repository.id
        )
        assert private_subscription_benefit is None

        organization_subscription_benefit = (
            await subscription_benefit_service.get_by_id(
                session, user, subscription_benefit_organization.id
            )
        )
        assert organization_subscription_benefit is None

    async def test_user_organization(
        self,
        session: AsyncSession,
        subscription_benefit_private_repository: SubscriptionBenefit,
        subscription_benefit_organization: SubscriptionBenefit,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        not_existing_subscription_benefit = (
            await subscription_benefit_service.get_by_id(session, user, uuid.uuid4())
        )
        assert not_existing_subscription_benefit is None

        private_subscription_benefit = await subscription_benefit_service.get_by_id(
            session, user, subscription_benefit_private_repository.id
        )
        assert private_subscription_benefit is not None
        assert (
            private_subscription_benefit.id
            == subscription_benefit_private_repository.id
        )

        organization_subscription_benefit = (
            await subscription_benefit_service.get_by_id(
                session, user, subscription_benefit_organization.id
            )
        )
        assert organization_subscription_benefit is not None
        assert (
            organization_subscription_benefit.id == subscription_benefit_organization.id
        )


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            organization_id=uuid.uuid4(),
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_benefit_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            organization_id=organization.id,
        )
        with pytest.raises(OrganizationDoesNotExist):
            await subscription_benefit_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            organization_id=organization.id,
        )
        subscription_benefit = await subscription_benefit_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_benefit.organization_id == organization.id

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            repository_id=uuid.uuid4(),
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_benefit_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            repository_id=repository.id,
        )
        with pytest.raises(RepositoryDoesNotExist):
            await subscription_benefit_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = SubscriptionBenefitCreate(
            type=SubscriptionBenefitType.plain,
            description="Subscription Benefit",
            repository_id=repository.id,
        )
        subscription_benefit = await subscription_benefit_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_benefit.repository_id == repository.id


@pytest.mark.asyncio
class TestUserUpdate:
    async def test_not_writable_subscription_benefit(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        update_schema = SubscriptionBenefitUpdate(
            description="Subscription Benefit Update"
        )
        with pytest.raises(NotPermitted):
            await subscription_benefit_service.user_update(
                session, authz, subscription_benefit_organization, update_schema, user
            )

    async def test_valid_description_change(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        update_schema = SubscriptionBenefitUpdate(description="Description update")
        updated_subscription_benefit = await subscription_benefit_service.user_update(
            session, authz, subscription_benefit_organization, update_schema, user
        )
        assert updated_subscription_benefit.description == "Description update"
