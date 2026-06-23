import pytest

from polar.auth.models import AuthSubject
from polar.models import Organization, User
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
)
from polar.models.user_organization import OrganizationRole, UserOrganization
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_support_case_attachment_file,
)


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_returns_case_for_managing_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)

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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is None

    @pytest.mark.auth
    async def test_none_for_member_without_manage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # A plain member lacks `organization:manage` — the chat is admin-only.
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)
        case = await create_appeal_case(save_fixture, organization)

        fetched = await support_case_service.get(session, auth_subject, case.id)

        assert fetched is None

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_returns_case_for_organization_subject(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)

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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(save_fixture, organization)
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
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(save_fixture, organization)
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
        case = await create_appeal_case(save_fixture, organization)

        assigned = await support_case_service.assign(session, case, assignee=user)
        assert case.assigned_user_id == user.id
        assert assigned.type == SupportCaseMessageType.assigned
        assert assigned.audience == []

        released = await support_case_service.unassign(session, case, actor=user)
        assert case.assigned_user_id is None
        assert released.type == SupportCaseMessageType.released
        assert released.audience == []
