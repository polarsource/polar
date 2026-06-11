import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.benefit.grant.service import BenefitGrantService
from polar.benefit.service import benefit as benefit_service
from polar.benefit.service import (  # type: ignore[attr-defined]
    benefit_grant_service,
)
from polar.benefit.strategies import (
    BenefitPropertiesValidationError,
    BenefitServiceProtocol,
)
from polar.benefit.strategies.custom.schemas import (
    BenefitCustomCreate,
    BenefitCustomCreateProperties,
    BenefitCustomUpdate,
)
from polar.benefit.strategies.discord.schemas import BenefitDiscordUpdate
from polar.benefit.strategies.feature_flag.schemas import BenefitFeatureFlagUpdate
from polar.benefit.strategies.slack_shared_channel.schemas import (
    BenefitSlackSharedChannelCreate,
    BenefitSlackSharedChannelCreateProperties,
    BenefitSlackSharedChannelUpdate,
)
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.kit.visibility import Visibility
from polar.models import Benefit, Organization, SlackApp, User, UserOrganization
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


async def create_slack_integration(
    save_fixture: SaveFixture, organization: Organization
) -> SlackApp:
    integration = SlackApp(
        organization_id=organization.id,
        display_name="Test",
        slack_app_id="A0TESTAPPID",
        client_id="100.200",
        client_secret="cs-test",
        signing_secret="ss-test",
        team_id="T1",
        team_name="Test team",
        bot_user_id="U1",
        bot_token="xoxb-test-token",
        authed_user_id="U2",
        scopes=["channels:manage"],
    )
    await save_fixture(integration)
    return integration


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.benefit.service.enqueue_job")


@pytest.mark.asyncio
class TestList:
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
            type=[BenefitType.custom],
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
            organization_id=[organization.id],
            pagination=PaginationParams(1, 10),
        )

        assert count == 3
        assert len(results) == 3

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == benefit_organization.id


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        benefit_organization: Benefit,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_benefit = await benefit_service.get(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get(
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

        not_existing_benefit = await benefit_service.get(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get(
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

        not_existing_benefit = await benefit_service.get(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_benefit is None

        organization_benefit = await benefit_service.get(
            session, auth_subject, benefit_organization.id
        )
        assert organization_benefit is not None


@pytest.mark.asyncio
class TestUserCreate:
    @pytest.mark.auth
    async def test_user_missing_organization(
        self, auth_subject: AuthSubject[User], session: AsyncSession, redis: Redis
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=None,
        )

        # then
        session.expunge_all()

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_not_existing_organization(
        self, auth_subject: AuthSubject[User], session: AsyncSession, redis: Redis
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_not_writable_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_user_valid_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        benefit = await benefit_service.user_create(
            session, redis, create_schema, auth_subject
        )
        assert benefit.organization_id == organization.id

    @pytest.mark.auth
    async def test_slack_shared_channel_disabled_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        create_schema = BenefitSlackSharedChannelCreate(
            type=BenefitType.slack_shared_channel,
            description="Benefit",
            properties=BenefitSlackSharedChannelCreateProperties(
                slack_integration_id=uuid.uuid4(),
                channel_name_template="support-{customer_name}",
                private=True,
                welcome_message=None,
                archive_on_revoke=True,
                team_invitees=[],
            ),
            organization_id=organization.id,
        )

        session.expunge_all()

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_slack_shared_channel_enabled_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            **organization.feature_settings,
            "slack_benefit_enabled": True,
        }
        await save_fixture(organization)
        integration = await create_slack_integration(save_fixture, organization)
        create_schema = BenefitSlackSharedChannelCreate(
            type=BenefitType.slack_shared_channel,
            description="Benefit",
            properties=BenefitSlackSharedChannelCreateProperties(
                slack_integration_id=integration.id,
                channel_name_template="support-{customer_name}",
                private=True,
                welcome_message="Welcome",
                archive_on_revoke=True,
                team_invitees=[],
            ),
            organization_id=organization.id,
        )

        session.expunge_all()

        benefit = await benefit_service.user_create(
            session, redis, create_schema, auth_subject
        )

        assert benefit.organization_id == organization.id
        assert benefit.type == BenefitType.slack_shared_channel
        assert dict(benefit.properties)["slack_integration_id"] == str(integration.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_set_organization_id(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        redis: Redis,
    ) -> None:
        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_invalid_properties(
        self,
        auth_subject: AuthSubject[User],
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        user_organization: UserOrganization,
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
        mock = mocker.patch("polar.benefit.service.get_benefit_strategy")
        mock.return_value = service_mock

        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(BenefitPropertiesValidationError):
            await benefit_service.user_create(
                session, redis, create_schema, auth_subject
            )

    @pytest.mark.auth
    async def test_custom_defaults_to_public(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        service_mock = MagicMock(spec=BenefitServiceProtocol)
        service_mock.validate_properties.return_value = {"note": None}
        mocker.patch(
            "polar.benefit.service.get_benefit_strategy", return_value=service_mock
        )

        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Custom benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=organization.id,
        )

        benefit = await benefit_service.user_create(
            session, redis, create_schema, auth_subject
        )

        assert benefit.visibility == Visibility.public

    @pytest.mark.auth
    async def test_custom_respects_private_visibility(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        service_mock = MagicMock(spec=BenefitServiceProtocol)
        service_mock.validate_properties.return_value = {"note": None}
        mocker.patch(
            "polar.benefit.service.get_benefit_strategy", return_value=service_mock
        )

        create_schema = BenefitCustomCreate(
            type=BenefitType.custom,
            description="Custom benefit",
            properties=BenefitCustomCreateProperties(note=None),
            organization_id=organization.id,
            visibility=Visibility.private,
        )

        benefit = await benefit_service.user_create(
            session, redis, create_schema, auth_subject
        )

        assert benefit.visibility == Visibility.private


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_description_change(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        benefit_organization: Benefit,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
    ) -> None:
        enqueue_benefit_grant_updates_mock = mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )

        update_schema = BenefitCustomUpdate(
            type=BenefitType.custom, description="Description update"
        )

        updated_benefit = await benefit_service.update(
            session,
            redis,
            benefit_organization,
            update_schema,
            auth_subject,
        )
        assert updated_benefit.description == "Description update"

        enqueue_benefit_grant_updates_mock.assert_awaited_once()

    @pytest.mark.auth
    async def test_slack_shared_channel_update_keeps_integration(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )
        integration = await create_slack_integration(save_fixture, organization)
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.slack_shared_channel,
            organization=organization,
            properties={
                "channel_name_template": "support-{customer_name}",
                "private": True,
                "welcome_message": None,
                "archive_on_revoke": True,
                "team_invitees": [],
                "slack_integration_id": str(integration.id),
            },
        )

        update_schema = BenefitSlackSharedChannelUpdate(
            type=BenefitType.slack_shared_channel,
            properties=BenefitSlackSharedChannelCreateProperties(
                slack_integration_id=integration.id,
                channel_name_template="vip-{customer_name}",
                private=True,
                welcome_message=None,
                archive_on_revoke=True,
                team_invitees=[],
            ),
        )

        updated_benefit = await benefit_service.update(
            session, redis, benefit, update_schema, auth_subject
        )

        properties = dict(updated_benefit.properties)
        assert properties["slack_integration_id"] == str(integration.id)
        assert properties["channel_name_template"] == "vip-{customer_name}"

    @pytest.mark.auth
    async def test_rejects_private_visibility_update_for_non_configurable_benefit(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.discord,
            properties={
                "guild_id": "123",
                "role_id": "456",
                "kick_member": False,
            },
        )

        update_schema = BenefitDiscordUpdate.model_validate(
            {"type": BenefitType.discord, "visibility": Visibility.private}
        )

        with pytest.raises(PolarRequestValidationError):
            await benefit_service.update(
                session, redis, benefit, update_schema, auth_subject
            )

    @pytest.mark.auth
    @pytest.mark.parametrize(
        ("visibility", "expected"),
        [
            (Visibility.public, Visibility.public),
            (None, None),
        ],
    )
    async def test_allows_public_visibility_update_for_non_configurable_benefit(
        self,
        visibility: Visibility | None,
        expected: Visibility | None,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )

        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.discord,
            properties={
                "guild_id": "123",
                "role_id": "456",
                "kick_member": False,
            },
        )

        update_schema = BenefitDiscordUpdate.model_validate(
            {"type": BenefitType.discord, "visibility": visibility}
        )

        updated_benefit = await benefit_service.update(
            session, redis, benefit, update_schema, auth_subject
        )

        assert updated_benefit.visibility == expected

    @pytest.mark.auth
    async def test_allows_visibility_update_for_custom_benefit(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )

        update_schema = BenefitCustomUpdate(
            type=BenefitType.custom,
            visibility=Visibility.private,
        )

        updated_benefit = await benefit_service.update(
            session, redis, benefit_organization, update_schema, auth_subject
        )

        assert updated_benefit.visibility == Visibility.private

    @pytest.mark.auth
    async def test_allows_visibility_update_for_feature_flag(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(
            benefit_grant_service,
            "enqueue_benefit_grant_updates",
            spec=BenefitGrantService.enqueue_benefit_grant_updates,
        )

        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={},
        )
        benefit.visibility = Visibility.private
        await save_fixture(benefit)

        update_schema = BenefitFeatureFlagUpdate(
            type=BenefitType.feature_flag,
            visibility=Visibility.public,
        )

        updated_benefit = await benefit_service.update(
            session, redis, benefit, update_schema, auth_subject
        )

        assert updated_benefit.visibility == Visibility.public


@pytest.mark.asyncio
class TestDelete:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_deletable_benefit(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            organization=organization,
            deletable=False,
        )

        with pytest.raises(NotPermitted):
            await benefit_service.delete(session, benefit, auth_subject)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        updated_benefit = await benefit_service.delete(
            session, benefit_organization, auth_subject
        )

        assert updated_benefit.deleted_at is not None

        enqueue_job_mock.assert_called_once_with(
            "benefit.delete", benefit_id=benefit_organization.id
        )
