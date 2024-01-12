import uuid

import pytest
from pytest_mock import MockerFixture

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
    SubscriptionBenefitCustomCreate,
    SubscriptionBenefitCustomProperties,
    SubscriptionBenefitCustomUpdate,
)
from polar.subscription.service.subscription_benefit import (  # type: ignore[attr-defined]
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
    subscription_benefit_grant_service,
)
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from polar.subscription.service.subscription_benefit_grant import (
    SubscriptionBenefitGrantService,
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
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
            session, type=SubscriptionBenefitType.custom, organization=organization
        )

        # then
        session.expunge_all()

        results, count = await subscription_benefit_service.search(
            session,
            user,
            type=SubscriptionBenefitType.custom,
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
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

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
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            organization_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

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
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

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
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        subscription_benefit = await subscription_benefit_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_benefit.organization_id == organization.id

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            repository_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

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
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

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
        create_schema = SubscriptionBenefitCustomCreate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit",
            is_tax_applicable=True,
            properties=SubscriptionBenefitCustomProperties(),
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

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
        update_schema = SubscriptionBenefitCustomUpdate(
            type=SubscriptionBenefitType.custom,
            description="Subscription Benefit Update",
        )

        # then
        session.expunge_all()

        # load
        subscription_benefit_organization_loaded = (
            await subscription_benefit_service.get(
                session, subscription_benefit_organization.id
            )
        )
        assert subscription_benefit_organization_loaded

        with pytest.raises(NotPermitted):
            await subscription_benefit_service.user_update(
                session,
                authz,
                subscription_benefit_organization_loaded,
                update_schema,
                user,
            )

    async def test_valid_description_change(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=SubscriptionBenefitGrantService.enqueue_benefit_grant_updates,
        )

        update_schema = SubscriptionBenefitCustomUpdate(
            type=SubscriptionBenefitType.custom, description="Description update"
        )

        # then
        session.expunge_all()

        # load
        subscription_benefit_organization_loaded = (
            await subscription_benefit_service.get(
                session, subscription_benefit_organization.id
            )
        )
        assert subscription_benefit_organization_loaded

        updated_subscription_benefit = await subscription_benefit_service.user_update(
            session,
            authz,
            subscription_benefit_organization_loaded,
            update_schema,
            user,
        )
        assert updated_subscription_benefit.description == "Description update"

        enqueue_benefit_grant_updates_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestUserDelete:
    async def test_not_writable_subscription_benefit(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_benefit_organization_loaded = (
            await subscription_benefit_service.get(
                session, subscription_benefit_organization.id
            )
        )
        assert subscription_benefit_organization_loaded

        with pytest.raises(NotPermitted):
            await subscription_benefit_service.user_delete(
                session, authz, subscription_benefit_organization_loaded, user
            )

    async def test_not_deletable_subscription_benefit(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        subscription_benefit = await create_subscription_benefit(
            session,
            type=SubscriptionBenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            deletable=False,
        )

        # then
        session.expunge_all()

        # load
        subscription_benefit_loaded = await subscription_benefit_service.get(
            session, subscription_benefit.id
        )
        assert subscription_benefit_loaded

        with pytest.raises(NotPermitted):
            await subscription_benefit_service.user_delete(
                session, authz, subscription_benefit_loaded, user
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "enqueue_benefit_grant_deletions",
            spec=SubscriptionBenefitGrantService.enqueue_benefit_grant_updates,
        )

        # then
        session.expunge_all()

        # load
        subscription_benefit_organization_loaded = (
            await subscription_benefit_service.get(
                session, subscription_benefit_organization.id
            )
        )
        assert subscription_benefit_organization_loaded

        updated_subscription_benefit = await subscription_benefit_service.user_delete(
            session, authz, subscription_benefit_organization_loaded, user
        )

        assert updated_subscription_benefit.deleted_at is not None

        enqueue_benefit_grant_updates_mock.assert_awaited_once()
