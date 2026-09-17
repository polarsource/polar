import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.judge.service import judge as judge_service
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

from .conftest import WHEN, FixedJudge, Tree, completion, ingest


@pytest.mark.asyncio
class TestJudgeEndpoint:
    async def test_judges_an_identity(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
        tree: Tree,
        mocker: MockerFixture,
    ) -> None:
        await create_token(
            save_fixture, organization, scopes={Scope.void_read, Scope.customers_read}
        )
        void_client.headers.update({"Authorization": f"Bearer {TOKEN}"})
        await ingest(session, organization, completion("e1"))
        mocker.patch.object(judge_service, "jev", FixedJudge(0.77))

        response = await void_client.post(
            "/v1/void/identities/child/judge",
            json={"meter": "tokens", "when": WHEN},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["noul"] == 0.77
        assert body["identity_id"] == "child"
        assert body["root_id"] == "root"
        assert body["over"] == {"amount": 1, "unit": "hour"}
        assert body["stale"] is False
        assert body["evidence"]["events"] == 1
        assert body["evidence"]["sample"][0]["id"] == "e1"

        missing = await void_client.post(
            "/v1/void/identities/child/judge",
            json={"meter": "nope", "when": WHEN},
        )
        assert missing.status_code == 404

        unknown = await void_client.post(
            "/v1/void/identities/ghost/judge",
            json={"meter": "tokens", "when": WHEN},
        )
        assert unknown.status_code == 404

    async def test_requires_customer_scope(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        tree: Tree,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        void_client.headers.update({"Authorization": f"Bearer {TOKEN}"})
        response = await void_client.post(
            "/v1/void/identities/child/judge",
            json={"meter": "tokens", "when": WHEN},
        )
        assert response.status_code == 403
