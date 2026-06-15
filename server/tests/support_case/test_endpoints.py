import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import File, Organization, OrganizationReview, User
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseMessageAuthorKind,
)
from polar.models.user_organization import UserOrganization
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account, create_organization

REASON = "Please reconsider my account — here is the additional context for the review."


@pytest_asyncio.fixture
async def denied_review(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationReview:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="Automated review denied.",
        model_used="test",
        appeal_decision=OrganizationReview.AppealDecision.REJECTED,
    )
    await save_fixture(review)
    return review


async def _open_case(
    session: AsyncSession,
    review: OrganizationReview,
    organization: Organization,
    user: User,
) -> ReviewAppealSupportCase:
    case = await appeal_case_service.request_human_review(
        session,
        review,
        reason=REASON,
        requested_by_user=user,
        organization=organization,
    )
    await session.flush()
    return case


async def _uploaded_attachment_file(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    service: FileServiceTypes = FileServiceTypes.support_case_attachment,
) -> File:
    file = File(
        organization=organization,
        name="evidence.pdf",
        path="support_case_attachment/evidence.pdf",
        mime_type="application/pdf",
        size=1234,
        service=service,
        is_uploaded=True,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestListSupportCases:
    async def test_unauthorized(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_empty(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases"
        )
        assert response.status_code == 200
        assert response.json()["items"] == []

    @pytest.mark.auth
    async def test_lists_cases(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases"
        )
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == str(case.id)
        assert items[0]["type"] == "review_appeal"
        assert items[0]["is_open"] is True
        # The merchant spoke last (the appeal reason), so it's the platform's turn.
        assert items[0]["awaiting_platform"] is True


@pytest.mark.asyncio
class TestGetSupportCase:
    @pytest.mark.auth
    async def test_returns_thread(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["case"]["type"] == "review_appeal"
        assert data["is_open"] is True
        assert REASON in [m["body"] for m in data["messages"]]

    @pytest.mark.auth
    async def test_not_found(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/"
            "00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_other_org_case_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # A case the authenticated org doesn't participate in must 404 (no leak).
        other_account = await create_account(save_fixture, user)
        other_org = await create_organization(
            save_fixture, other_account, name_prefix="otherorg"
        )
        other_review = OrganizationReview(
            organization_id=other_org.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=90.0,
            violated_sections=[],
            reason="denied",
            model_used="test",
        )
        await save_fixture(other_review)
        other_case = await _open_case(session, other_review, other_org, user)

        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{other_case.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_internal_note_hidden(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        await appeal_case_service.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=user,
            body="internal staff note",
            internal=True,
        )
        await session.flush()
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
        )
        assert response.status_code == 200
        assert "internal staff note" not in [
            m["body"] for m in response.json()["messages"]
        ]


@pytest.mark.asyncio
class TestReplyToSupportCase:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        response = await client.post(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}/messages",
            json={"body": "here is more detail"},
        )
        assert response.status_code == 200
        assert response.json()["body"] == "here is more detail"

    @pytest.mark.auth
    async def test_with_attachment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}/messages",
            json={"body": "see attached", "file_ids": [str(file.id)]},
        )
        assert response.status_code == 200

        thread = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
        )
        attachments = thread.json()["attachments"]
        assert len(attachments) == 1
        assert attachments[0]["file"]["name"] == "evidence.pdf"

    @pytest.mark.auth
    async def test_file_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        response = await client.post(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}/messages",
            json={"file_ids": ["11111111-1111-4111-8111-111111111111"]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_locked_after_decision(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="final"
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}/messages",
            json={"body": "please reconsider again"},
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestDownloadSupportCaseAttachment:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        await client.post(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}/messages",
            json={"file_ids": [str(file.id)]},
        )
        thread = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
        )
        attachment_id = thread.json()["attachments"][0]["id"]

        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
            f"/attachments/{attachment_id}/download"
        )
        assert response.status_code == 302
        assert response.headers["location"]

    @pytest.mark.auth
    async def test_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, denied_review, organization, user)
        response = await client.get(
            f"/v1/organizations/{organization.id}/support/cases/{case.id}"
            "/attachments/00000000-0000-0000-0000-000000000000/download"
        )
        assert response.status_code == 404
