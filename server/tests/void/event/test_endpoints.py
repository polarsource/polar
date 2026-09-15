import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.event.repository import EventRepository
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/events"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.asyncio
class TestIngest:
    async def test_accepts_without_tinybird_or_temporal(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        body = [{"external_id": "request", "name": "usage", "metadata": {"value": 2}}]
        response = await void_client.post(PATH, headers=HEADERS, json=body)
        assert response.status_code == 202
        assert response.json() == {"saved": 1, "ignored": 0}
        assert (
            len(
                await EventRepository.from_session(session).pending(
                    {organization.id}, limit=50
                )
            )
            == 1
        )
        repeated = await void_client.post(PATH, headers=HEADERS, json=body)
        assert repeated.status_code == 202
        assert repeated.json() == {"saved": 0, "ignored": 1}

    async def test_read_token_cannot_write(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        response = await void_client.post(
            PATH, headers=HEADERS, json=[{"external_id": "request", "name": "usage"}]
        )
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "body",
        [
            [{"external_id": "request", "name": ""}],
            [{"external_id": "", "name": "usage"}],
            [
                {
                    "external_id": "request",
                    "name": "usage",
                    "timestamp": "2025-01-01T00:00:00",
                }
            ],
            [{"external_id": "request", "name": "usage", "external_identity_id": ""}],
            [
                {
                    "external_id": "request",
                    "name": "usage",
                    "timestamp": "0001-01-01T00:00:00+14:00",
                }
            ],
            [
                {
                    "external_id": "request",
                    "name": "usage",
                    "timestamp": "2106-01-01T00:00:00Z",
                }
            ],
        ],
    )
    async def test_invalid_payload(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        body: list[dict[str, str]],
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(PATH, headers=HEADERS, json=body)
        assert response.status_code == 422

    async def test_reserved_event_name(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(
            PATH,
            headers=HEADERS,
            json=[{"external_id": "request", "name": "identity.entitlements.updated"}],
        )
        assert response.status_code == 403
