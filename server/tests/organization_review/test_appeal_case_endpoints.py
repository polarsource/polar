import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import File, OrganizationReview
from polar.models.file import FileServiceTypes
from polar.models.organization import Organization
from polar.models.support_case import SupportCaseMessageAuthorKind
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

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


async def _uploaded_attachment_file(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    service: FileServiceTypes = FileServiceTypes.support_case_attachment,
    is_uploaded: bool = True,
) -> File:
    file = File(
        organization=organization,
        name="evidence.pdf",
        path="support_case_attachment/evidence.pdf",
        mime_type="application/pdf",
        size=1234,
        service=service,
        is_uploaded=is_uploaded,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestRequestHumanReview:
    async def test_unauthorized(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "review_appeal"

    @pytest.mark.auth
    async def test_reason_too_short(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": "too short"},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_duplicate(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestGetAppealCase:
    @pytest.mark.auth
    async def test_not_found_without_case(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 404

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
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 200
        data = response.json()
        assert data["is_open"] is True
        assert REASON in [m["body"] for m in data["messages"]]

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
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await appeal_case_service.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=user,
            body="internal staff note",
            internal=True,
        )
        await session.flush()
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 200
        assert "internal staff note" not in [
            m["body"] for m in response.json()["messages"]
        ]


@pytest.mark.asyncio
class TestReplyToAppealCase:
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
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"body": "here is more detail"},
        )
        assert response.status_code == 200
        assert response.json()["body"] == "here is more detail"

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
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="final"
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"body": "please reconsider again"},
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestReplyWithAttachments:
    @pytest.mark.auth
    async def test_body_and_files(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        file_a = await _uploaded_attachment_file(save_fixture, organization)
        file_b = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()

        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={
                "body": "see attached",
                "file_ids": [str(file_a.id), str(file_b.id)],
            },
        )
        assert response.status_code == 200
        assert response.json()["body"] == "see attached"

        thread = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        attachments = thread.json()["attachments"]
        assert len(attachments) == 2
        assert attachments[0]["file"]["name"] == "evidence.pdf"
        assert all(a["message_id"] is not None for a in attachments)

    @pytest.mark.auth
    async def test_files_without_body(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()

        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert response.status_code == 200
        assert response.json()["body"] is None

    @pytest.mark.auth
    async def test_empty_reply_rejected(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={},
        )
        assert response.status_code == 422

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
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": ["11111111-1111-4111-8111-111111111111"]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_wrong_file_service(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        file = await _uploaded_attachment_file(
            save_fixture, organization, service=FileServiceTypes.downloadable
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_file_not_uploaded(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        file = await _uploaded_attachment_file(
            save_fixture, organization, is_uploaded=False
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_locked_after_decision(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="final"
        )
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestDownloadAppealCaseAttachment:
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
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        attach = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert attach.status_code == 200

        thread = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        attachment_id = thread.json()["attachments"][0]["id"]

        response = await client.get(
            f"/v1/organizations/{organization.id}"
            f"/appeal/case/attachments/{attachment_id}/download",
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
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.get(
            f"/v1/organizations/{organization.id}/appeal/case/attachments/"
            "00000000-0000-0000-0000-000000000000/download",
        )
        assert response.status_code == 404
