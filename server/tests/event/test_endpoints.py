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

    @pytest.mark.auth
    async def test_children_sorting(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that children are sorted according to sorting parameter."""
        base_time = utc_now()

        root_event1 = await create_event(
            save_fixture,
            organization=organization,
            name="root1",
            timestamp=base_time - timedelta(hours=10),
        )

        root_event2 = await create_event(
            save_fixture,
            organization=organization,
            name="root2",
            timestamp=base_time - timedelta(hours=5),
        )

        child1 = await create_event(
            save_fixture,
            organization=organization,
            name="child1",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=3),
        )

        child2 = await create_event(
            save_fixture,
            organization=organization,
            name="child2",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=1),
        )

        child3 = await create_event(
            save_fixture,
            organization=organization,
            name="child3",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=2),
        )

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
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that depth parameter correctly filters events by hierarchy level."""
        base_time = utc_now()

        root_event1 = await create_event(
            save_fixture,
            organization=organization,
            name="root1",
            timestamp=base_time - timedelta(hours=10),
        )

        root_event2 = await create_event(
            save_fixture,
            organization=organization,
            name="root2",
            timestamp=base_time - timedelta(hours=5),
        )

        child1 = await create_event(
            save_fixture,
            organization=organization,
            name="child1",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=3),
        )

        child2 = await create_event(
            save_fixture,
            organization=organization,
            name="child2",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=1),
        )

        child3 = await create_event(
            save_fixture,
            organization=organization,
            name="child3",
            parent_id=root_event1.id,
            timestamp=base_time - timedelta(hours=2),
        )

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
