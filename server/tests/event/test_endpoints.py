from collections.abc import Awaitable, Callable
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.integrations.tinybird.client import TinybirdClient
from polar.kit.utils import utc_now
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Event, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest_asyncio.fixture
async def event_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
) -> Event:
    return await create_event(save_fixture, organization=organization_second)


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
        buffered_save_fixture: SaveFixture,
        flush_tinybird_events: Callable[[], Awaitable[None]],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            buffered_save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
            metadata={"tokens": 10},
        )
        event2 = await create_event(
            buffered_save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
            metadata={"tokens": 100},
        )

        await flush_tinybird_events()

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

    @pytest.mark.auth
    async def test_children_sorting(
        self,
        buffered_save_fixture: SaveFixture,
        flush_tinybird_events: Callable[[], Awaitable[None]],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that children are sorted according to sorting parameter."""
        base_time = utc_now()

        root_event1 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="root1",
            timestamp=base_time - timedelta(hours=10),
        )

        root_event2 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="root2",
            timestamp=base_time - timedelta(hours=5),
        )

        child1 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child1",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=3),
        )

        child2 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child2",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=1),
        )

        child3 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child3",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=2),
        )

        await flush_tinybird_events()

        # Test descending sort (newest first) - no depth returns all events
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "sorting": "-timestamp",
            },
        )

        assert response.status_code == 200
        json = response.json()

        items = json["items"]
        assert len(items) == 5

        # All events should be sorted newest to oldest
        assert items[0]["id"] == str(child2.id)  # 1 hours ago
        assert items[1]["id"] == str(child3.id)  # 2 hours ago
        assert items[2]["id"] == str(child1.id)  # 3 hours ago
        assert items[3]["id"] == str(root_event2.id)  # 5 hours ago
        assert items[4]["id"] == str(root_event1.id)  # 10 hours ago
        assert items[4]["child_count"] == 3

        # Query children with descending sort (parent_id excludes the parent itself)
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "parent_id": str(root_event1.id),
                "sorting": "-timestamp",
                "depth": "1",
            },
        )

        assert response.status_code == 200
        json = response.json()
        items = json["items"]
        assert len(items) == 3  # only children, not parent
        assert items[0]["id"] == str(child2.id)  # 1 hour ago
        assert items[1]["id"] == str(child3.id)  # 2 hours ago
        assert items[2]["id"] == str(child1.id)  # 3 hours ago

        # Test ascending sort (oldest first) - no depth returns all events
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "sorting": "timestamp",
            },
        )

        assert response.status_code == 200
        json = response.json()

        items = json["items"]
        assert len(items) == 5

        # All events should be sorted oldest to newest
        assert items[0]["id"] == str(root_event1.id)  # 10 hours ago
        assert items[1]["id"] == str(root_event2.id)  # 5 hours ago
        assert items[2]["id"] == str(child1.id)  # 3 hours ago
        assert items[3]["id"] == str(child3.id)  # 2 hours ago
        assert items[4]["id"] == str(child2.id)  # 1 hours ago

        # Query children with ascending sort (parent_id excludes the parent itself)
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "parent_id": str(root_event1.id),
                "sorting": "timestamp",
                "depth": "1",
            },
        )

        assert response.status_code == 200
        json = response.json()
        items = json["items"]
        assert len(items) == 3  # only children, not parent
        assert items[0]["id"] == str(child1.id)  # 3 hours ago
        assert items[1]["id"] == str(child3.id)  # 2 hours ago
        assert items[2]["id"] == str(child2.id)  # 1 hour ago

    @pytest.mark.auth
    async def test_depth_filtering(
        self,
        buffered_save_fixture: SaveFixture,
        flush_tinybird_events: Callable[[], Awaitable[None]],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that depth parameter correctly filters events by hierarchy level."""
        base_time = utc_now()

        root_event1 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="root1",
            timestamp=base_time - timedelta(hours=10),
        )

        root_event2 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="root2",
            timestamp=base_time - timedelta(hours=5),
        )

        child1 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child1",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=3),
        )

        child2 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child2",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=1),
        )

        child3 = await create_event(
            buffered_save_fixture,
            organization=organization,
            name="child3",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=2),
        )

        await flush_tinybird_events()

        # Test descending sort (newest first) - depth=0 returns only root events
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "sorting": "-timestamp",
                "depth": "0",
            },
        )

        assert response.status_code == 200
        json = response.json()

        items = json["items"]
        assert len(items) == 2

        # Root events should be sorted newest to oldest
        assert items[0]["id"] == str(root_event2.id)  # 5 hours ago
        assert items[1]["id"] == str(root_event1.id)  # 10 hours ago
        assert items[1]["child_count"] == 3

        # Query children with descending sort (parent_id excludes the parent itself)
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "parent_id": str(root_event1.id),
                "sorting": "-timestamp",
                "depth": "1",
            },
        )

        assert response.status_code == 200
        json = response.json()
        items = json["items"]
        assert len(items) == 3  # only children, not parent
        assert items[0]["id"] == str(child2.id)  # 1 hour ago
        assert items[1]["id"] == str(child3.id)  # 2 hours ago
        assert items[2]["id"] == str(child1.id)  # 3 hours ago

        # Test ascending sort (oldest first) - depth=0 returns only root events
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "sorting": "timestamp",
                "depth": "0",
            },
        )

        assert response.status_code == 200
        json = response.json()

        items = json["items"]
        assert len(items) == 2

        # Root events should be sorted oldest to newest
        assert items[0]["id"] == str(root_event1.id)  # 10 hours ago
        assert items[1]["id"] == str(root_event2.id)  # 5 hours ago

        # Query children with ascending sort (parent_id excludes the parent itself)
        response = await client.get(
            "/v1/events/",
            params={
                "organization_id": str(organization.id),
                "parent_id": str(root_event1.id),
                "sorting": "timestamp",
                "depth": "1",
            },
        )

        assert response.status_code == 200
        json = response.json()
        items = json["items"]
        assert len(items) == 3  # only children, not parent
        assert items[0]["id"] == str(child1.id)  # 3 hours ago
        assert items[1]["id"] == str(child3.id)  # 2 hours ago
        assert items[2]["id"] == str(child2.id)  # 1 hour ago


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
        assert json == {"inserted": len(events), "duplicates": 0}


SQLI_PAYLOADS = [
    pytest.param("' OR '1'='1", id="string-breakout"),
    pytest.param("_cost.amount' --", id="comment-injection"),
    pytest.param("x}' AS NUMERIC)); DROP TABLE events --", id="drop-table"),
    pytest.param(
        'x}\' AS NUMERIC) + (SELECT count(*) FROM "user"))--',
        id="subquery-exfil",
    ),
    pytest.param(
        "x}', (SELECT to_jsonb(email) FROM users LIMIT 1), true)--",
        id="jsonb-set-exfil",
    ),
    pytest.param(
        "}||(SELECT CASE WHEN (SELECT 1)=1 THEN pg_sleep(3) END)--",
        id="sleep-injection",
    ),
]


@pytest.mark.asyncio
class TestAggregateFieldsValidation:
    """Malicious aggregate_fields values must be rejected with 422 before
    reaching any SQL execution path."""

    @pytest.mark.auth
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_list(
        self,
        payload: str,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/events/",
            params={"aggregate_fields": payload},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_get(
        self,
        payload: str,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/events/{uuid4()}",
            params={"aggregate_fields": payload},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    async def test_statistics_timeseries(
        self,
        payload: str,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        today = date.today()
        response = await client.get(
            "/v1/events/statistics/timeseries",
            params={
                "aggregate_fields": payload,
                "start_date": str(today - timedelta(days=7)),
                "end_date": str(today),
                "interval": "day",
            },
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestGetStatisticsByProperty:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/statistics/by-property")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestGetStatisticsByCustomer:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/statistics/by-customer")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestGetStatisticsByVariance:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/statistics/by-variance")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestListStatisticsTimeseries:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/statistics/timeseries")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestListEventNames:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/events/names")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestGetEvent:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/events/{uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_event(
        self,
        client: AsyncClient,
        tinybird_client: TinybirdClient,
        user_organization: UserOrganization,
        event_organization_second: Event,
    ) -> None:
        response = await client.get(f"/v1/events/{event_organization_second.id}")

        assert response.status_code == 404
