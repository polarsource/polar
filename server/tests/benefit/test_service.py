import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.exceptions import RequestValidationError
from pytest_mock import MockerFixture

from polar.authz.service import Authz
from polar.benefit.schemas import (
    BenefitCustomCreate,
    BenefitCustomProperties,
    BenefitCustomUpdate,
)
from polar.benefit.service import (  # type: ignore[attr-defined]
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
    subscription_benefit_grant_service,
)
from polar.benefit.service import benefit as benefit_service
from polar.exceptions import NotPermitted
from polar.kit.pagination import PaginationParams
from polar.models import (
    Benefit,
    Organization,
    Repository,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.subscription.service.benefits import (
    SubscriptionBenefitPropertiesValidationError,
    SubscriptionBenefitServiceProtocol,
)
from polar.subscription.service.subscription_benefit_grant import (
    SubscriptionBenefitGrantService,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    async def test_user(
        self,
        session: AsyncSession,
        benefits: list[Benefit],
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(results) == 0

    async def test_user_organization(
        self,
        session: AsyncSession,
        user: User,
        benefits: list[Benefit],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == len(benefits)
        assert len(results) == len(benefits)

    async def test_filter_type(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        plain_subscription_benefit = await create_benefit(
            save_fixture, type=BenefitType.custom, organization=organization
        )

        # then
        session.expunge_all()

        results, count = await benefit_service.search(
            session,
            user,
            type=BenefitType.custom,
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
        benefits: list[Benefit],
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == benefit_organization.id

    async def test_filter_organization_indirect(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        benefits: list[Benefit],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.search(
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
        benefits: list[Benefit],
        benefit_private_repository: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.search(
            session, user, repository=repository, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == benefit_private_repository.id


@pytest.mark.asyncio
class TestGetById:
    async def test_user(
        self,
        session: AsyncSession,
        benefit_private_repository: Benefit,
        benefit_organization: Benefit,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_subscription_benefit = await benefit_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_benefit is None

        private_subscription_benefit = await benefit_service.get_by_id(
            session, user, benefit_private_repository.id
        )
        assert private_subscription_benefit is None

        organization_subscription_benefit = await benefit_service.get_by_id(
            session, user, benefit_organization.id
        )
        assert organization_subscription_benefit is None

    async def test_user_organization(
        self,
        session: AsyncSession,
        benefit_private_repository: Benefit,
        benefit_organization: Benefit,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_subscription_benefit = await benefit_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_benefit is None

        private_subscription_benefit = await benefit_service.get_by_id(
            session, user, benefit_private_repository.id
        )
        assert private_subscription_benefit is not None
        assert private_subscription_benefit.id == benefit_private_repository.id

        organization_subscription_benefit = await benefit_service.get_by_id(
            session, user, benefit_organization.id
        )
        assert organization_subscription_benefit is not None
        assert organization_subscription_benefit.id == benefit_organization.id


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            organization_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await benefit_service.user_create(session, authz, create_schema, user)

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await benefit_service.user_create(session, authz, create_schema, user)

    async def test_valid_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        subscription_benefit = await benefit_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_benefit.organization_id == organization.id

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            repository_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(RepositoryDoesNotExist):
            await benefit_service.user_create(session, authz, create_schema, user)

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(RepositoryDoesNotExist):
            await benefit_service.user_create(session, authz, create_schema, user)

    async def test_valid_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

        subscription_benefit = await benefit_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_benefit.repository_id == repository.id

    async def test_invalid_properties(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        service_mock = MagicMock(spec=SubscriptionBenefitServiceProtocol)
        service_mock.validate_properties.side_effect = (
            SubscriptionBenefitPropertiesValidationError(
                [
                    {
                        "type": "property_error",
                        "message": "The property is invalid",
                        "loc": ("key",),
                        "input": "foobar",
                    }
                ]
            )
        )
        mock = mocker.patch(
            "polar.subscription.service.subscription_benefit" ".get_benefit_service"
        )
        mock.return_value = service_mock

        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(RequestValidationError):
            await benefit_service.user_create(session, authz, create_schema, user)


@pytest.mark.asyncio
class TestUserUpdate:
    async def test_not_writable_benefit(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        update_schema = BenefitCustomUpdate(
            type=BenefitType.custom,
            description="Benefit Update",
        )

        # then
        session.expunge_all()

        # load
        benefit_organization_loaded = await benefit_service.get(
            session, benefit_organization.id
        )
        assert benefit_organization_loaded

        with pytest.raises(NotPermitted):
            await benefit_service.user_update(
                session,
                authz,
                benefit_organization_loaded,
                update_schema,
                user,
            )

    async def test_valid_description_change(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        user: User,
        benefit_organization: Benefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=SubscriptionBenefitGrantService.enqueue_benefit_grant_updates,
        )

        update_schema = BenefitCustomUpdate(
            type=BenefitType.custom, description="Description update"
        )

        # then
        session.expunge_all()

        # load
        benefit_organization_loaded = await benefit_service.get(
            session, benefit_organization.id
        )
        assert benefit_organization_loaded

        updated_subscription_benefit = await benefit_service.user_update(
            session,
            authz,
            benefit_organization_loaded,
            update_schema,
            user,
        )
        assert updated_subscription_benefit.description == "Description update"

        enqueue_benefit_grant_updates_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestUserDelete:
    async def test_not_writable_benefit(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        # load
        benefit_organization_loaded = await benefit_service.get(
            session, benefit_organization.id
        )
        assert benefit_organization_loaded

        with pytest.raises(NotPermitted):
            await benefit_service.user_delete(
                session, authz, benefit_organization_loaded, user
            )

    async def test_not_deletable_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        subscription_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            deletable=False,
        )

        # then
        session.expunge_all()

        # load
        subscription_benefit_loaded = await benefit_service.get(
            session, subscription_benefit.id
        )
        assert subscription_benefit_loaded

        with pytest.raises(NotPermitted):
            await benefit_service.user_delete(
                session, authz, subscription_benefit_loaded, user
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        user: User,
        benefit_organization: Benefit,
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
        benefit_organization_loaded = await benefit_service.get(
            session, benefit_organization.id
        )
        assert benefit_organization_loaded

        updated_subscription_benefit = await benefit_service.user_delete(
            session, authz, benefit_organization_loaded, user
        )

        assert updated_subscription_benefit.deleted_at is not None

        enqueue_benefit_grant_updates_mock.assert_awaited_once()
