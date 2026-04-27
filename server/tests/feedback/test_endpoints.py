import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from polar.models import Feedback, Organization, User, UserOrganization
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


def _payload(organization: Organization, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "type": FeedbackType.bug.value,
        "message": "Something is broken in the dashboard.",
        "organization_id": str(organization.id),
        "client_context": {"url": "https://polar.sh/dashboard"},
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
class TestSubmitFeedback:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post("/v1/feedbacks/", json=_payload(organization))
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_message_too_short(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/feedbacks/", json=_payload(organization, message="too short")
        )
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_missing_organization_id(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        payload = _payload(organization)
        del payload["organization_id"]
        response = await client.post("/v1/feedbacks/", json=payload)
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_not_member_of_organization(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post("/v1/feedbacks/", json=_payload(organization))
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_unknown_organization_id(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payload = _payload(organization, organization_id=str(uuid.uuid4()))
        response = await client.post("/v1/feedbacks/", json=payload)
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post("/v1/feedbacks/", json=_payload(organization))
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_valid(
        self,
        session: AsyncSession,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post("/v1/feedbacks/", json=_payload(organization))
        assert response.status_code == 201

        body = response.json()
        assert body["type"] == FeedbackType.bug.value
        assert body["status"] == FeedbackStatus.new.value
        assert body["organization_id"] == str(organization.id)
        assert body["user_id"] == str(user.id)
        assert body["client_context"] == {"url": "https://polar.sh/dashboard"}

        stored = (
            await session.execute(select(Feedback).where(Feedback.id == body["id"]))
        ).scalar_one()
        assert stored.message == "Something is broken in the dashboard."
        assert stored.user_id == user.id
        assert stored.organization_id == organization.id
