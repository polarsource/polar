import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.benefit.strategies import BenefitPropertiesValidationError
from polar.benefit.strategies.discord.schemas import BenefitDiscordCreateProperties
from polar.benefit.strategies.discord.service import BenefitDiscordService
from polar.config import settings
from polar.integrations.discord.schemas import DiscordGuild, DiscordGuildRole
from polar.kit import jwt
from polar.models import DiscordGuildConnection, Organization, User, UserOrganization
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture

GUILD_ID = "123456789"
ROLE_ID = "987654321"
_PROPERTIES = {"guild_id": GUILD_ID, "role_id": ROLE_ID, "kick_member": False}


async def _create_connection(
    save_fixture: SaveFixture, organization: Organization
) -> DiscordGuildConnection:
    connection = DiscordGuildConnection(organization=organization, guild_id=GUILD_ID)
    await save_fixture(connection)
    return connection


def _mock_discord(mocker: MockerFixture) -> None:
    guild = DiscordGuild(
        name="Test",
        roles=[
            DiscordGuildRole.model_validate(
                {
                    "id": ROLE_ID,
                    "name": "Supporter",
                    "position": 1,
                    "is_polar_bot": False,
                    "color": "000000",
                }
            )
        ],
    )
    mocker.patch(
        "polar.benefit.strategies.discord.service.discord_bot_service.get_guild",
        return_value=guild,
    )
    mocker.patch(
        "polar.benefit.strategies.discord.service.discord_bot_service.is_bot_role_above_role",
        return_value=True,
    )


@pytest.mark.asyncio
class TestValidateProperties:
    @pytest.mark.auth
    async def test_guild_not_connected(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
        organization: Organization,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        get_guild_mock = mocker.patch(
            "polar.benefit.strategies.discord.service.discord_bot_service.get_guild"
        )
        strategy = BenefitDiscordService(session, redis)

        with pytest.raises(BenefitPropertiesValidationError) as excinfo:
            await strategy.validate_properties(
                auth_subject, organization, dict(_PROPERTIES)
            )

        assert excinfo.value.errors()[0]["type"] == "guild_not_connected"
        get_guild_mock.assert_not_called()

    @pytest.mark.auth
    async def test_guild_connected_by_another_organization(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        await _create_connection(save_fixture, organization_second)
        strategy = BenefitDiscordService(session, redis)

        with pytest.raises(BenefitPropertiesValidationError) as excinfo:
            await strategy.validate_properties(
                auth_subject, organization, dict(_PROPERTIES)
            )

        assert excinfo.value.errors()[0]["type"] == "guild_not_connected"

    @pytest.mark.auth
    async def test_guild_connected(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
    ) -> None:
        await _create_connection(save_fixture, organization)
        _mock_discord(mocker)
        strategy = BenefitDiscordService(session, redis)

        properties = await strategy.validate_properties(
            auth_subject, organization, dict(_PROPERTIES)
        )

        assert properties["guild_id"] == GUILD_ID


class TestCreateProperties:
    def test_guild_id(self) -> None:
        properties = BenefitDiscordCreateProperties.model_validate(_PROPERTIES)

        assert properties.model_dump(mode="json", by_alias=True) == _PROPERTIES

    def test_guild_token_resolves_to_guild_id(self) -> None:
        token = jwt.encode(
            data={"guild_id": GUILD_ID},
            secret=settings.SECRET,
            type="discord_guild_token",
        )

        properties = BenefitDiscordCreateProperties.model_validate(
            {"guild_token": token, "role_id": ROLE_ID, "kick_member": False}
        )

        assert properties.model_dump(mode="json", by_alias=True) == _PROPERTIES

    def test_guild_id_wins_over_guild_token(self) -> None:
        token = jwt.encode(
            data={"guild_id": "other"},
            secret=settings.SECRET,
            type="discord_guild_token",
        )

        properties = BenefitDiscordCreateProperties.model_validate(
            {**_PROPERTIES, "guild_token": token}
        )

        assert properties.guild_id == GUILD_ID

    def test_neither_guild_id_nor_guild_token(self) -> None:
        with pytest.raises(ValidationError):
            BenefitDiscordCreateProperties.model_validate(
                {"role_id": ROLE_ID, "kick_member": False}
            )

    def test_invalid_guild_token(self) -> None:
        with pytest.raises(ValidationError):
            BenefitDiscordCreateProperties.model_validate(
                {"guild_token": "nope", "role_id": ROLE_ID, "kick_member": False}
            )
