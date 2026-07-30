import uuid

import pytest
from httpx import AsyncClient

from polar.models import (
    CompassThread,
    CompassThreadMessage,
    Organization,
    User,
    UserOrganization,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def _create_thread(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    user: User | None = None,
    title: str = "Thread",
) -> CompassThread:
    thread = CompassThread(
        organization_id=organization.id,
        user_id=user.id if user is not None else None,
        title=title,
    )
    await save_fixture(thread)
    return thread


@pytest.mark.asyncio
class TestAssistantChat:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(organization.id), "prompt": "hi"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_inaccessible_organization(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(uuid.uuid4()), "prompt": "hi"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_compass_disabled_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {}
        await save_fixture(organization)

        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(organization.id), "prompt": "hi"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_someone_elses_thread(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user_second: User,
    ) -> None:
        organization.feature_settings = {"compass_enabled": True}
        await save_fixture(organization)
        thread = await _create_thread(save_fixture, organization, user=user_second)

        response = await client.post(
            "/v1/compass/assistant",
            json={
                "organization_id": str(organization.id),
                "prompt": "hi",
                "thread_id": str(thread.id),
            },
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestListThreads:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/compass/threads",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_lists_only_own_threads(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
        user_second: User,
    ) -> None:
        mine = await _create_thread(save_fixture, organization, user=user, title="Mine")
        await _create_thread(save_fixture, organization, user=user_second)
        await _create_thread(save_fixture, organization, user=None)

        response = await client.get(
            "/v1/compass/threads",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(mine.id)
        assert json["items"][0]["title"] == "Mine"

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_token_lists_userless_threads(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        await _create_thread(save_fixture, organization, user=user)
        shared = await _create_thread(save_fixture, organization, user=None)

        response = await client.get(
            "/v1/compass/threads",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(shared.id)


@pytest.mark.asyncio
class TestGetThread:
    @pytest.mark.auth
    async def test_not_found_for_someone_elses_thread(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user_second: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user_second)

        response = await client.get(f"/v1/compass/threads/{thread.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_returns_messages_with_parts(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)
        await save_fixture(
            CompassThreadMessage(
                thread=thread,
                prompt="How is my MRR?",
                parts=[{"kind": "text", "text": "MRR is up 12%."}],
                model_messages=[],
            )
        )

        response = await client.get(f"/v1/compass/threads/{thread.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(thread.id)
        assert len(json["messages"]) == 1
        message = json["messages"][0]
        assert message["prompt"] == "How is my MRR?"
        assert message["parts"] == [{"kind": "text", "text": "MRR is up 12%."}]


@pytest.mark.asyncio
class TestUpdateThread:
    @pytest.mark.auth
    async def test_rename(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)

        response = await client.patch(
            f"/v1/compass/threads/{thread.id}",
            json={"title": "Churn investigation"},
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Churn investigation"

    @pytest.mark.auth
    async def test_not_found_for_someone_elses_thread(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user_second: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user_second)

        response = await client.patch(
            f"/v1/compass/threads/{thread.id}", json={"title": "Hijacked"}
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteThread:
    @pytest.mark.auth
    async def test_deleted_thread_disappears(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user)

        response = await client.delete(f"/v1/compass/threads/{thread.id}")
        assert response.status_code == 204

        response = await client.get(f"/v1/compass/threads/{thread.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_found_for_someone_elses_thread(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user_second: User,
    ) -> None:
        thread = await _create_thread(save_fixture, organization, user=user_second)

        response = await client.delete(f"/v1/compass/threads/{thread.id}")

        assert response.status_code == 404
