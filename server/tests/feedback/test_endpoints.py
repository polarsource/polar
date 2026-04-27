import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from polar.models import Feedback, Organization, User, UserOrganization
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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
        response = await client.post("/v1/feedback/", json=_payload(organization))
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_message_too_short(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/feedback/", json=_payload(organization, message="too short")
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
        response = await client.post("/v1/feedback/", json=payload)
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_not_member_of_organization(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post("/v1/feedback/", json=_payload(organization))
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_unknown_organization_id(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payload = _payload(organization, organization_id=str(uuid.uuid4()))
        response = await client.post("/v1/feedback/", json=payload)
        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post("/v1/feedback/", json=_payload(organization))
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
        response = await client.post("/v1/feedback/", json=_payload(organization))
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

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_rate_limited_after_max(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        for _ in range(5):
            await save_fixture(
                Feedback(
                    type=FeedbackType.feedback,
                    message="prior submission",
                    client_context={},
                    user_id=user.id,
                    organization_id=organization.id,
                )
            )

        response = await client.post("/v1/feedback/", json=_payload(organization))
        assert response.status_code == 429
        # Submissions are fresh, so Retry-After should be near the full window.
        retry_after = int(response.headers["Retry-After"])
        assert 3540 <= retry_after <= 3600

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_validation_errors_dont_count_against_rate_limit(
        self,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # 10 invalid attempts (well above the rate limit) should not consume
        # any of the user's budget because the count is performed only after
        # validation + membership checks.
        for _ in range(10):
            response = await client.post(
                "/v1/feedback/", json=_payload(organization, message="x")
            )
            assert response.status_code == 422

        response = await client.post("/v1/feedback/", json=_payload(organization))
        assert response.status_code == 201

        count = (await session.execute(select(func.count(Feedback.id)))).scalar_one()
        assert count == 1
