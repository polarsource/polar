import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from polar.models.file import File, FileServiceTypes
from polar.models.organization import Organization
from polar.models.support_case import (
    Case,
    CaseAttachment,
    CaseMessage,
    CaseMessageAuthorKind,
    CaseMessageType,
    CaseParticipant,
    CaseParticipantKind,
    CaseType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestParticipantUniqueness:
    async def test_duplicate_subject_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = Case(type=CaseType.review_appeal, resource_id=uuid.uuid4())
        await save_fixture(case)
        await save_fixture(
            CaseParticipant(
                case_id=case.id,
                kind=CaseParticipantKind.merchant,
                organization_id=organization.id,
            )
        )
        session.add(
            CaseParticipant(
                case_id=case.id,
                kind=CaseParticipantKind.merchant,
                organization_id=organization.id,
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()


@pytest.mark.asyncio
class TestAttachmentCaseConsistency:
    async def test_message_from_other_case_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case_a = Case(type=CaseType.review_appeal, resource_id=uuid.uuid4())
        await save_fixture(case_a)
        message_a = CaseMessage(
            case_id=case_a.id,
            type=CaseMessageType.chat,
            author_kind=CaseMessageAuthorKind.merchant,
            audience=[],
        )
        await save_fixture(message_a)

        case_b = Case(type=CaseType.review_appeal, resource_id=uuid.uuid4())
        await save_fixture(case_b)

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
            CaseAttachment(
                case_id=case_b.id,
                message_id=message_a.id,
                file_id=file.id,
                audience=[],
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()
