import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy import select

from polar.kit.encryption import EncryptedString
from polar.models import Organization, SlackApp
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _build(organization: Organization) -> SlackApp:
    return SlackApp(
        organization_id=organization.id,
        display_name="Test",
        slack_app_id="A1",
        client_id="100.200",
    )


@pytest.mark.asyncio
class TestEncryptClassmethods:
    """Covers the classmethods used by the create and ``update_dict`` write
    paths in the Slack integration service."""

    async def test_encrypt_client_secret(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()

        encrypted = await SlackApp.encrypt_client_secret(integration.id, "cs-test")

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(integration.id)) == "cs-test"

    async def test_encrypt_signing_secret(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()

        encrypted = await SlackApp.encrypt_signing_secret(integration.id, "ss-test")

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(integration.id)) == "ss-test"

    async def test_encrypt_bot_token(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()

        encrypted = await SlackApp.encrypt_bot_token(integration.id, "xoxb-test")

        assert isinstance(encrypted, EncryptedString)
        assert await encrypted.decrypt(id=str(integration.id)) == "xoxb-test"

    async def test_encrypt_none_returns_none(self, organization: Organization) -> None:
        row_id = SlackApp.generate_id()
        assert await SlackApp.encrypt_client_secret(row_id, None) is None
        assert await SlackApp.encrypt_signing_secret(row_id, None) is None
        assert await SlackApp.encrypt_bot_token(row_id, None) is None

    async def test_binds_ciphertext_to_row_id(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()

        encrypted = await SlackApp.encrypt_client_secret(integration.id, "cs-test")

        assert isinstance(encrypted, EncryptedString)
        with pytest.raises(InvalidTag):
            await encrypted.decrypt(id="not-the-row-id")


@pytest.mark.asyncio
class TestGetSecrets:
    async def test_prefers_encrypted(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()
        integration.client_secret_encrypted = await SlackApp.encrypt_client_secret(
            integration.id, "cs-encrypted"
        )
        integration.signing_secret_encrypted = await SlackApp.encrypt_signing_secret(
            integration.id, "ss-encrypted"
        )
        integration.bot_token_encrypted = await SlackApp.encrypt_bot_token(
            integration.id, "xoxb-encrypted"
        )
        integration.client_secret = "cs-plain"
        integration.signing_secret = "ss-plain"
        integration.bot_token = "xoxb-plain"

        assert await integration.get_client_secret() == "cs-encrypted"
        assert await integration.get_signing_secret() == "ss-encrypted"
        assert await integration.get_bot_token() == "xoxb-encrypted"

    async def test_falls_back_to_plain(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()
        integration.client_secret = "cs-plain"
        integration.signing_secret = "ss-plain"
        integration.bot_token = "xoxb-plain"

        assert await integration.get_client_secret() == "cs-plain"
        assert await integration.get_signing_secret() == "ss-plain"
        assert await integration.get_bot_token() == "xoxb-plain"

    async def test_none_without_encrypted(self, organization: Organization) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()

        assert await integration.get_client_secret() is None
        assert await integration.get_signing_secret() is None
        assert await integration.get_bot_token() is None

    async def test_resolves_each_secret_independently(
        self, organization: Organization
    ) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()
        integration.client_secret_encrypted = await SlackApp.encrypt_client_secret(
            integration.id, "cs-encrypted"
        )
        integration.signing_secret = "ss-plain"
        integration.bot_token = None

        assert await integration.get_client_secret() == "cs-encrypted"
        assert await integration.get_signing_secret() == "ss-plain"
        assert await integration.get_bot_token() is None


@pytest.mark.asyncio
class TestPersistence:
    async def test_round_trip_through_database(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        integration = _build(organization)
        integration.id = SlackApp.generate_id()
        integration.client_secret = "cs-test"
        integration.client_secret_encrypted = await SlackApp.encrypt_client_secret(
            integration.id, "cs-test"
        )
        integration.signing_secret = "ss-test"
        integration.signing_secret_encrypted = await SlackApp.encrypt_signing_secret(
            integration.id, "ss-test"
        )
        integration.bot_token = "xoxb-test"
        integration.bot_token_encrypted = await SlackApp.encrypt_bot_token(
            integration.id, "xoxb-test"
        )
        await save_fixture(integration)
        integration_id = integration.id

        session.expunge_all()
        loaded = await session.scalar(
            select(SlackApp).where(SlackApp.id == integration_id)
        )

        assert loaded is not None
        assert isinstance(loaded.client_secret_encrypted, EncryptedString)
        assert isinstance(loaded.signing_secret_encrypted, EncryptedString)
        assert isinstance(loaded.bot_token_encrypted, EncryptedString)
        assert (
            await loaded.client_secret_encrypted.decrypt(id=str(loaded.id)) == "cs-test"
        )
        assert (
            await loaded.signing_secret_encrypted.decrypt(id=str(loaded.id))
            == "ss-test"
        )
        assert (
            await loaded.bot_token_encrypted.decrypt(id=str(loaded.id)) == "xoxb-test"
        )
