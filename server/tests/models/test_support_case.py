import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from polar.models.file import FileServiceTypes
from polar.models.organization import Organization
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseAttachment,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseMessageRepository
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_organization_review,
    create_support_case_attachment_file,
)


@pytest.mark.asyncio
class TestReviewAppealRequiresReview:
    async def test_orphan_rejected(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        # A review_appeal case with no organization_review violates the CHECK
        # (organization is set so the NOT NULL isn't what trips first).
        session.add(ReviewAppealSupportCase(organization=organization))
        with pytest.raises(IntegrityError):
            await session.flush()


@pytest.mark.asyncio
class TestParticipantUniqueness:
    async def test_duplicate_subject_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = await create_organization_review(save_fixture, organization)
        case = ReviewAppealSupportCase(
            organization_review=review, organization=organization
        )
        await save_fixture(case)

        await save_fixture(
            SupportCaseParticipant(
                case=case,
                kind=SupportCaseParticipantKind.merchant,
                organization=organization,
            )
        )
        session.add(
            SupportCaseParticipant(
                case=case,
                kind=SupportCaseParticipantKind.merchant,
                organization=organization,
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()


@pytest.mark.asyncio
class TestAddAttachment:
    async def test_links_to_message(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = ReviewAppealSupportCase(
            organization_review=await create_organization_review(
                save_fixture, organization
            ),
            organization=organization,
        )
        await save_fixture(case)
        message = await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[SupportCaseAudience.merchant],
        )
        file = await create_support_case_attachment_file(save_fixture, organization)

        attachment = await support_case_service.add_attachment(
            session,
            case,
            file=file,
            message=message,
            audience=[SupportCaseAudience.merchant],
        )
        assert attachment.message_id == message.id
        assert attachment.file_id == file.id
        assert attachment.audience == [SupportCaseAudience.merchant]

    async def test_case_level_without_message(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = ReviewAppealSupportCase(
            organization_review=await create_organization_review(
                save_fixture, organization
            ),
            organization=organization,
        )
        await save_fixture(case)
        file = await create_support_case_attachment_file(save_fixture, organization)

        attachment = await support_case_service.add_attachment(session, case, file=file)
        assert attachment.message_id is None
        assert attachment.audience == []


@pytest.mark.asyncio
class TestAttachmentCaseConsistency:
    async def test_message_from_other_case_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        case_a = ReviewAppealSupportCase(
            organization_review=await create_organization_review(
                save_fixture, organization
            ),
            organization=organization,
        )
        await save_fixture(case_a)
        case_b = ReviewAppealSupportCase(
            organization_review=await create_organization_review(
                save_fixture, organization_second
            ),
            organization=organization_second,
        )
        await save_fixture(case_b)

        message_a = SupportCaseMessage(
            case=case_a,
            type=SupportCaseMessageType.chat,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[],
        )
        await save_fixture(message_a)

        file = await create_support_case_attachment_file(
            save_fixture, organization, service=FileServiceTypes.downloadable
        )

        # An attachment on case_b pointing at a message that lives in case_a.
        # message_id stays scalar: the composite (case_id, message_id) FK is the
        # very thing under test, so we set a deliberately mismatched pair.
        session.add(
            SupportCaseAttachment(
                case=case_b,
                message_id=message_a.id,
                file=file,
                audience=[],
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()


@pytest.mark.asyncio
class TestAwaitingPlatformExpression:
    async def _awaiting(self, session: AsyncSession, case_id: object) -> bool:
        expr = SupportCaseMessageRepository.awaiting_platform_expression()
        result = await session.execute(
            select(expr).select_from(SupportCase).where(SupportCase.id == case_id)
        )
        return result.scalar_one()

    async def test_tracks_latest_external_author(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = ReviewAppealSupportCase(
            organization_review=await create_organization_review(
                save_fixture, organization
            ),
            organization=organization,
        )
        await save_fixture(case)

        # A participant opens the conversation -> platform owes a reply.
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[SupportCaseAudience.merchant],
        )
        assert await self._awaiting(session, case.id) is True

        # Platform replies -> no longer awaiting.
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[SupportCaseAudience.merchant],
        )
        assert await self._awaiting(session, case.id) is False

        # An internal note (empty audience) must NOT flip it back.
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[],
        )
        assert await self._awaiting(session, case.id) is False

        # A fresh participant message -> awaiting again.
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[SupportCaseAudience.merchant],
        )
        assert await self._awaiting(session, case.id) is True
