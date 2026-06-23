import pytest

from polar.auth.models import AuthSubject
from polar.models import File, Organization, OrganizationReview, User
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
)
from polar.models.user_organization import OrganizationRole, UserOrganization
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def _open_case(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    author_user: User,
) -> ReviewAppealSupportCase:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="denied",
        model_used="test",
    )
    await save_fixture(review)
    return await support_case_service.create(
        session,
        ReviewAppealSupportCase(organization_review=review, organization=organization),
        author_kind=SupportCaseMessageAuthorKind.merchant,
        author_user=author_user,
        audience=[SupportCaseAudience.merchant],
    )


async def _attachment_file(
    save_fixture: SaveFixture, organization: Organization
) -> File:
    file = File(
        organization=organization,
        name="evidence.pdf",
        path="support_case_attachment/evidence.pdf",
        mime_type="application/pdf",
        size=1234,
        service=FileServiceTypes.support_case_attachment,
        is_uploaded=True,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_returns_case_for_managing_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is not None
        assert fetched.id == case.id

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_none_for_non_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is None

    @pytest.mark.auth
    async def test_none_for_member_without_manage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # A plain member lacks `organization:manage` — the chat is admin-only.
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)
        case = await _open_case(session, save_fixture, organization, author_user=user)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is None

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_returns_case_for_organization_subject(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is not None
        assert fetched.id == case.id


@pytest.mark.asyncio
class TestGetThread:
    async def test_open_and_audience_filtered(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="internal note",
            audience=[],
        )
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="merchant reply",
            audience=[SupportCaseAudience.merchant],
        )

        is_open, messages = await support_case_service.get_thread(
            session, case, visible_to=SupportCaseAudience.merchant
        )

        assert is_open is True
        bodies = [message.body for message in messages]
        assert "internal note" not in bodies
        assert "merchant reply" in bodies

    async def test_platform_sees_internal_notes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="internal note",
            audience=[],
        )

        _, messages = await support_case_service.get_thread(
            session, case, visible_to=None
        )

        assert "internal note" in [message.body for message in messages]

    async def test_closed_case(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)
        await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[SupportCaseAudience.merchant],
        )

        is_open, _ = await support_case_service.get_thread(
            session, case, visible_to=SupportCaseAudience.merchant
        )

        assert is_open is False


@pytest.mark.asyncio
class TestGetAttachment:
    async def test_hidden_when_not_in_audience(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)
        file = await _attachment_file(save_fixture, organization)
        attachment = await support_case_service.add_attachment(
            session, case, file=file, audience=[]
        )

        fetched = await support_case_service.get_attachment(
            session, case, attachment.id, visible_to=SupportCaseAudience.merchant
        )

        assert fetched is None

    async def test_returned_when_visible(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        case = await _open_case(session, save_fixture, organization, author_user=user)
        file = await _attachment_file(save_fixture, organization)
        attachment = await support_case_service.add_attachment(
            session, case, file=file, audience=[SupportCaseAudience.merchant]
        )

        fetched = await support_case_service.get_attachment(
            session, case, attachment.id, visible_to=SupportCaseAudience.merchant
        )

        assert fetched is not None
        assert fetched.id == attachment.id


@pytest.mark.asyncio
class TestAssignment:
    async def test_events_are_internal(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # The audience must stay empty: assignment is platform-only churn and
        # must never surface in the merchant-visible thread.
        case = await _open_case(session, save_fixture, organization, author_user=user)

        assigned = await support_case_service.assign(session, case, assignee=user)
        assert case.assigned_user_id == user.id
        assert assigned.type == SupportCaseMessageType.assigned
        assert assigned.audience == []

        released = await support_case_service.unassign(session, case, actor=user)
        assert case.assigned_user_id is None
        assert released.type == SupportCaseMessageType.released
        assert released.audience == []
