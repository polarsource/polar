import pytest
from sqlalchemy.exc import IntegrityError

from polar.models import OrganizationReview
from polar.models.file import File, FileServiceTypes
from polar.models.organization import Organization
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseAttachment,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.database import SaveFixture


async def _attachment_file(
    save_fixture: SaveFixture, organization: Organization
) -> File:
    file = File(
        organization_id=organization.id,
        name="evidence.pdf",
        path="evidence.pdf",
        mime_type="application/pdf",
        size=1,
        service=FileServiceTypes.support_case_attachment,
    )
    await save_fixture(file)
    return file


async def _review(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationReview:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="denied",
        model_used="test",
    )
    await save_fixture(review)
    return review


@pytest.mark.asyncio
class TestReviewAppealRequiresReview:
    async def test_orphan_rejected(self, session: AsyncSession) -> None:
        # A review_appeal case with no organization_review_id violates the CHECK.
        session.add(ReviewAppealSupportCase())
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
        review = await _review(save_fixture, organization)
        case = ReviewAppealSupportCase(organization_review_id=review.id)
        await save_fixture(case)

        await save_fixture(
            SupportCaseParticipant(
                case_id=case.id,
                kind=SupportCaseParticipantKind.merchant,
                organization_id=organization.id,
            )
        )
        session.add(
            SupportCaseParticipant(
                case_id=case.id,
                kind=SupportCaseParticipantKind.merchant,
                organization_id=organization.id,
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
            organization_review_id=(await _review(save_fixture, organization)).id
        )
        await save_fixture(case)
        message = await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[SupportCaseAudience.merchant],
        )
        file = await _attachment_file(save_fixture, organization)

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
            organization_review_id=(await _review(save_fixture, organization)).id
        )
        await save_fixture(case)
        file = await _attachment_file(save_fixture, organization)

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
            organization_review_id=(await _review(save_fixture, organization)).id
        )
        await save_fixture(case_a)
        case_b = ReviewAppealSupportCase(
            organization_review_id=(await _review(save_fixture, organization_second)).id
        )
        await save_fixture(case_b)

        message_a = SupportCaseMessage(
            case_id=case_a.id,
            type=SupportCaseMessageType.chat,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[],
        )
        await save_fixture(message_a)

        file = File(
            organization_id=organization.id,
            name="evidence.pdf",
            path="evidence.pdf",
            mime_type="application/pdf",
            size=1,
            service=FileServiceTypes.downloadable,
        )
        await save_fixture(file)

        # An attachment on case_b pointing at a message that lives in case_a.
        session.add(
            SupportCaseAttachment(
                case_id=case_b.id,
                message_id=message_a.id,
                file_id=file.id,
                audience=[],
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()
