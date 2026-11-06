import pytest
from sqlalchemy import select

from polar.models import BackofficeUser, Organization, OrganizationReviewFeedback, User
from polar.models.support_case import (
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncSession
from scripts.backfill_backoffice_attribution import backfill_batch
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_appeal_case


@pytest.mark.anyio
async def test_backfills_staff_references_only(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> None:
    case = await create_appeal_case(save_fixture, organization)
    case.assigned_user = user
    feedback = OrganizationReviewFeedback(organization=organization, reviewer=user)
    participant = SupportCaseParticipant(
        case=case, kind=SupportCaseParticipantKind.platform, platform_user=user
    )
    staff_message = SupportCaseMessage(
        case=case,
        author_user=user,
        author_kind=SupportCaseMessageAuthorKind.platform,
        type=SupportCaseMessageType.chat,
    )
    merchant_message = SupportCaseMessage(
        case=case,
        author_user=user,
        author_kind=SupportCaseMessageAuthorKind.merchant,
        type=SupportCaseMessageType.chat,
    )
    session.add_all([feedback, participant, staff_message, merchant_message])
    await session.flush()

    for _ in range(4):
        assert await backfill_batch(session, 1) == 1
    assert await backfill_batch(session, 1) == 0

    for record in (case, feedback, participant, staff_message, merchant_message):
        await session.refresh(record)
    staff = (await session.scalars(select(BackofficeUser))).one()
    assert case.backoffice_assigned_user_id == staff.id
    assert feedback.backoffice_reviewer_id == staff.id
    assert participant.backoffice_platform_user_id == staff.id
    assert staff_message.backoffice_author_user_id == staff.id
    assert merchant_message.backoffice_author_user_id is None
