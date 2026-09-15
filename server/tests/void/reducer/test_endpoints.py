import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/reducers"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BODY = {
    "slug": "count",
    "filter": {"conjunction": "and", "clauses": []},
    "aggregation": {"func": "count"},
}


@pytest.mark.asyncio
class TestReducerEndpoints:
    async def test_create_list_get_and_conflict(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(PATH, headers=HEADERS, json=BODY)
        assert response.status_code == 201
        created = response.json()
        assert created["type"] == "scalar"
        assert created["map"] is None
        assert (await void_client.get(PATH, headers=HEADERS)).json() == [created]
        assert (
            await void_client.get(f"{PATH}/{created['id']}", headers=HEADERS)
        ).json() == created
        assert (
            await void_client.post(PATH, headers=HEADERS, json=BODY)
        ).status_code == 409
        assert (
            await void_client.get(f"{PATH}/{created['id']}/records", headers=HEADERS)
        ).status_code == 400

    async def test_read_scope_cannot_create(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        assert (
            await void_client.post(PATH, headers=HEADERS, json=BODY)
        ).status_code == 403
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 200

    async def test_foreign_reducer_hidden(
        self,
        void_client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_token(save_fixture, organization)
        foreign = await reducer_service.create(
            session, organization_second.id, ReducerCreate.model_validate(BODY)
        )
        assert (
            await void_client.get(f"{PATH}/{foreign.id}", headers=HEADERS)
        ).status_code == 404
        assert (
            await void_client.get(f"{PATH}/{foreign.id}/records", headers=HEADERS)
        ).status_code == 404
