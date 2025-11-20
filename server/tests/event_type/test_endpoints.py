import uuid

import pytest
from httpx import AsyncClient

from polar.models import EventType, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestUpdateEventType:
    async def test_anonymous(self, client: AsyncClient, event_type: EventType) -> None:
        response = await client.patch(
            f"/v1/event_types/{event_type.id}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(self, client: AsyncClient, event_type: EventType) -> None:
        response = await client.patch(
            f"/v1/event_types/{event_type.id}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/event_types/{uuid.uuid4()}",
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
            f"/v1/event_types/{event_type.id}",
            json={"label": "Updated Label"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(event_type.id)
        assert json["label"] == "Updated Label"
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
            f"/v1/event_types/{other_org_event_type.id}",
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
            f"/v1/event_types/{event_type.id}",
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
            f"/v1/event_types/{event_type.id}",
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
            f"/v1/event_types/{event_type.id}",
            json={"label": "Test Label 🎉 with émojis & symbols!"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["label"] == "Test Label 🎉 with émojis & symbols!"
