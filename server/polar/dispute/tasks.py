import uuid

from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
)
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .dispute_case import DISPUTE_GREETING


@actor(actor_name="dispute.post_dispute_greeting", priority=TaskPriority.LOW)
async def post_dispute_greeting(case_id: uuid.UUID) -> None:
    """Post the automated greeting after the merchant's first dispute reply."""
    async with AsyncSessionMaker() as session:
        case = await SupportCaseRepository.from_session(session).get_by_id(case_id)
        if case is None:
            return

        message_repository = SupportCaseMessageRepository.from_session(session)
        if not await message_repository.is_open(case_id):
            return

        existing = await message_repository.list_by_case(case_id, visible_to=None)
        if any(message.body == DISPUTE_GREETING for message in existing):
            return

        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.system,
            body=DISPUTE_GREETING,
            audience=[SupportCaseAudience.merchant],
        )
