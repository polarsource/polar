import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import EventType, Organization, UserOrganization
from polar.models.event import EventSource
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_event_type


@pytest.mark.asyncio
class TestListEventTypes:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/event-types/")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/event-types/")

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_empty_list(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/event-types/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0
        assert json["items"] == []

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_list_with_stats(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="test.event.1",
            label="Test Event 1",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization,
            name="test.event.2",
            label="Test Event 2",
        )

        base_time = utc_now()
        for i in range(5):
            await create_event(
                save_fixture,
                organization=organization,
                event_type=event_type_1,
                timestamp=base_time - timedelta(days=i),
            )

        for i in range(3):
            await create_event(
                save_fixture,
                organization=organization,
                event_type=event_type_2,
                timestamp=base_time - timedelta(days=i),
            )

        response = await client.get("/v1/event-types/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2

        items = json["items"]
        assert len(items) == 2

        items_by_name = {item["name"]: item for item in items}
        assert "test.event.1" in items_by_name
        assert "test.event.2" in items_by_name

        item_1 = items_by_name["test.event.1"]
        assert item_1["label"] == "Test Event 1"
        assert item_1["occurrences"] == 5
        assert "first_seen" in item_1
        assert "last_seen" in item_1

        item_2 = items_by_name["test.event.2"]
        assert item_2["label"] == "Test Event 2"
        assert item_2["occurrences"] == 3

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_filter_by_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="test.event.1",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization_second,
            name="test.event.2",
        )

        await create_event(
            save_fixture, organization=organization, event_type=event_type_1
        )
        await create_event(
            save_fixture, organization=organization_second, event_type=event_type_2
        )

        response = await client.get(
            "/v1/event-types/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "test.event.1"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_search_by_query(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="api.request",
            label="API Request",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization,
            name="user.login",
            label="User Login",
        )

        await create_event(
            save_fixture, organization=organization, event_type=event_type_1
        )
        await create_event(
            save_fixture, organization=organization, event_type=event_type_2
        )

        response = await client.get("/v1/event-types/", params={"query": "API"})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "api.request"

        response = await client.get("/v1/event-types/", params={"query": "user"})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "user.login"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_sorting(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="zzz.event",
            label="ZZZ Event",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization,
            name="aaa.event",
            label="AAA Event",
        )

        base_time = utc_now()
        await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_1,
            timestamp=base_time - timedelta(hours=2),
        )
        await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_2,
            timestamp=base_time - timedelta(hours=1),
        )

        response = await client.get("/v1/event-types/", params={"sorting": "name"})

        assert response.status_code == 200
        json = response.json()
        assert json["items"][0]["name"] == "aaa.event"
        assert json["items"][1]["name"] == "zzz.event"

        response = await client.get("/v1/event-types/", params={"sorting": "-label"})

        assert response.status_code == 200
        json = response.json()
        labels = [item["label"] for item in json["items"]]
        assert labels == ["ZZZ Event", "AAA Event"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_pagination(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        for i in range(15):
            event_type = await create_event_type(
                save_fixture,
                organization=organization,
                name=f"event.{i:02d}",
            )
            await create_event(
                save_fixture, organization=organization, event_type=event_type
            )

        response = await client.get("/v1/event-types/", params={"limit": 10})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 15
        assert len(json["items"]) == 10

        response = await client.get("/v1/event-types/", params={"limit": 10, "page": 2})

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 5

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_filter_by_parent_id(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        from polar.models.event import EventSource

        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="root.event",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization,
            name="child.event",
        )

        root_event = await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_1,
            source=EventSource.user,
        )
        await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_2,
            parent_id=root_event.id,
            source=EventSource.user,
        )

        response = await client.get("/v1/event-types/", params={"root_events": True})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "root.event"

        response = await client.get(
            "/v1/event-types/", params={"parent_id": str(root_event.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "child.event"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.events_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read}),
    )
    async def test_filter_by_source(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        event_type_1 = await create_event_type(
            save_fixture,
            organization=organization,
            name="user.event",
        )
        event_type_2 = await create_event_type(
            save_fixture,
            organization=organization,
            name="system.event",
        )

        await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_1,
            source=EventSource.user,
        )
        await create_event(
            save_fixture,
            organization=organization,
            event_type=event_type_2,
            source=EventSource.system,
        )

        response = await client.get("/v1/event-types/", params={"source": "user"})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "user.event"

        response = await client.get("/v1/event-types/", params={"source": "system"})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["name"] == "system.event"


@pytest.mark.asyncio
class TestUpdateEventType:
    async def test_anonymous(self, client: AsyncClient, event_type: EventType) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(self, client: AsyncClient, event_type: EventType) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/event-types/{uuid.uuid4()}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        event_type: EventType,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": "Updated Label", "label_property_selector": "subject"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(event_type.id)
        assert json["label"] == "Updated Label"
        assert json["label_property_selector"] == "subject"
        assert json["name"] == event_type.name
        assert json["organization_id"] == str(organization.id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_label_not_owned_by_org(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        other_org_event_type = EventType(
            name="test.event",
            label="Original Label",
            organization_id=organization_second.id,
        )
        await save_fixture(other_org_event_type)

        response = await client.patch(
            f"/v1/event-types/{other_org_event_type.id}",
            json={"label": "Hacked Label"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_empty_label(
        self,
        client: AsyncClient,
        event_type: EventType,
    ) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": ""},
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_whitespace_label(
        self,
        client: AsyncClient,
        event_type: EventType,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": "   "},
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_label_with_special_characters(
        self,
        client: AsyncClient,
        event_type: EventType,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/event-types/{event_type.id}",
            json={"label": "Test Label 🎉 with émojis & symbols!"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["label"] == "Test Label 🎉 with émojis & symbols!"
