from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.integrations.plain.service import plain as plain_service
from polar.models import Feedback
from polar.models.feedback import FeedbackStatus
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import FeedbackRepository


@actor(actor_name="feedback.reply_in_plain", priority=TaskPriority.LOW)
async def feedback_reply_in_plain(feedback_id: UUID) -> None:
    """
    Automatically open a Plain support thread for a freshly submitted question.

    Mirrors the manual "Reply in Plain" backoffice action: it impersonates the
    customer with the message they wrote and attaches the full conversation
    transcript as an internal note.
    """
    if not plain_service.enabled:
        return

    async with AsyncSessionMaker() as session:
        repository = FeedbackRepository.from_session(session)
        feedback = await repository.get_by_id(
            feedback_id, options=(joinedload(Feedback.user),)
        )
        if feedback is None:
            return
        # A thread may already exist if backoffice created one manually first.
        if feedback.support_thread_url is not None:
            return

        thread_url = await plain_service.create_feedback_thread(feedback)
        # The thread was created successfully, so the question is now being
        # handled in Plain: mark it as triaged in the backoffice.
        await repository.update(
            feedback,
            update_dict={
                "support_thread_url": thread_url,
                "status": FeedbackStatus.triaged,
            },
        )
