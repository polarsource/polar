from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest.mark.asyncio
class TestListEvents:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/events/")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_invalid_filter(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/events/", params={"filter": "hello"})

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_filter(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
            metadata={"tokens": 10},
        )
        event2 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
            metadata={"tokens": 100},
        )

        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="tokens",
                    operator=FilterOperator.gt,
                    value=50,
                )
            ],
        )
        response = await client.get(
            "/v1/events/", params={"filter": filter.model_dump_json()}
        )

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(event2.id)


@pytest.mark.asyncio
class TestIngest:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/events/ingest", json={"events": []})

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize(
        "events",
        [
            [
                {
                    "name": "event1",
                    "external_customer_id": "CUSTOMER_ID",
                    "metadata": {"usage": 127.32},
                }
            ]
        ],
    )
    async def test_valid(
        self, events: list[dict[str, Any]], client: AsyncClient
    ) -> None:
        response = await client.post("/v1/events/ingest", json={"events": events})

        assert response.status_code == 200
        json = response.json()
        assert json == {"inserted": len(events)}
