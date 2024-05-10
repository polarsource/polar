import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.exceptions import RequestValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.authz.service import Authz
from polar.benefit.benefits import (
    BenefitPropertiesValidationError,
    BenefitServiceProtocol,
)
from polar.benefit.schemas import (
    BenefitCustomCreate,
    BenefitCustomProperties,
    BenefitCustomUpdate,
)
from polar.benefit.service.benefit import (  # type: ignore[attr-defined]
    OrganizationDoesNotExist,
    benefit_grant_service,
)
from polar.benefit.service.benefit import benefit as benefit_service
from polar.benefit.service.benefit_grant import BenefitGrantService
from polar.exceptions import NotPermitted
from polar.kit.pagination import PaginationParams
from polar.models import Benefit, Organization, User, UserOrganization
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestSearch:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        benefits: list[Benefit],
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(results) == 0

    @pytest.mark.auth
    async def test_user_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        user: User,
        benefits: list[Benefit],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == len(benefits)
        assert len(results) == len(benefits)

    @pytest.mark.auth
    async def test_filter_type(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        plain_benefit = await create_benefit(
            save_fixture, type=BenefitType.custom, organization=organization
        )

        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session,
            auth_subject,
            type=BenefitType.custom,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == plain_benefit.id

    @pytest.mark.auth
    async def test_filter_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        benefits: list[Benefit],
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert count == 3
        assert len(results) == 3
        assert results[0].id == benefit_organization.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == benefit_organization.id


@pytest.mark.asyncio
class TestGetById:
    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_benefit = await benefit_service.get_by_id(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )
        assert organization_benefit is None

    @pytest.mark.auth
    async def test_user_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_benefit = await benefit_service.get_by_id(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )
        assert organization_benefit is not None
        assert organization_benefit.id == benefit_organization.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_benefit = await benefit_service.get_by_id(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )
        assert organization_benefit is not None


@pytest.mark.asyncio
class TestUserCreate:
    @pytest.mark.auth
    async def test_user_missing_organization(
        self, auth_subject: AuthSubject[User], session: AsyncSession, authz: Authz
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            is_tax_applicable=True,
            properties=BenefitCustomProperties(),
        )

        # then
        session.expunge_all()

        with pytest.raises(RequestValidationError):
            await benefit_service.user_create(
                session, authz, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_not_existing_organization(
        self, auth_subject: AuthSubject[User], session: AsyncSession, authz: Authz
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

        with pytest.raises(RequestValidationError):
            await benefit_service.user_create(
                session, authz, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_not_writable_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
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
            await benefit_service.user_create(
                session, authz, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_valid_organization(
        self,
        auth_subject: AuthSubject[User],
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

        benefit = await benefit_service.user_create(
            session, authz, create_schema, auth_subject
        )
        assert benefit.organization_id == organization.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_set_organization_id(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
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

        with pytest.raises(RequestValidationError):
            await benefit_service.user_create(
                session, authz, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_invalid_properties(
        self,
        auth_subject: AuthSubject[User],
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        service_mock = MagicMock(spec=BenefitServiceProtocol)
        service_mock.validate_properties.side_effect = BenefitPropertiesValidationError(
            [
                {
                    "type": "property_error",
                    "msg": "The property is invalid",
                    "loc": ("key",),
                    "input": "foobar",
                }
            ]
        )
        mock = mocker.patch("polar.benefit.service.benefit.get_benefit_service")
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

        with pytest.raises(BenefitPropertiesValidationError):
            await benefit_service.user_create(
                session, authz, create_schema, auth_subject
            )


@pytest.mark.asyncio
class TestUserUpdate:
    @pytest.mark.auth
    async def test_user_not_writable_benefit(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
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
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_description_change(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        benefit_organization: Benefit,
        auth_subject: AuthSubject[User | Organization],
        user_organization_admin: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
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

        updated_benefit = await benefit_service.user_update(
            session, authz, benefit_organization_loaded, update_schema, auth_subject
        )
        assert updated_benefit.description == "Description update"

        enqueue_benefit_grant_updates_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestUserDelete:
    @pytest.mark.auth
    async def test_user_not_writable_benefit(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
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
                session, authz, benefit_organization_loaded, auth_subject
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_deletable_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        organization: Organization,
        user_organization_admin: UserOrganization,
        auth_subject: AuthSubject[User | Organization],
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            deletable=False,
        )

        # then
        session.expunge_all()

        # load
        benefit_loaded = await benefit_service.get(session, benefit.id)
        assert benefit_loaded

        with pytest.raises(NotPermitted):
            await benefit_service.user_delete(
                session, authz, benefit_loaded, auth_subject
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        authz: Authz,
        benefit_organization: Benefit,
        auth_subject: AuthSubject[User | Organization],
        user_organization_admin: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_deletions",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )

        # then
        session.expunge_all()

        # load
        benefit_organization_loaded = await benefit_service.get(
            session, benefit_organization.id
        )
        assert benefit_organization_loaded

        updated_benefit = await benefit_service.user_delete(
            session, authz, benefit_organization_loaded, auth_subject
        )

        assert updated_benefit.deleted_at is not None

        enqueue_benefit_grant_updates_mock.assert_awaited_once()
