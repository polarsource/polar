from uuid import UUID

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import resend as resend_service


@actor(actor_name="resend.sync_user", priority=TaskPriority.LOW)
async def sync_user(user_id: UUID, previous_email: str | None = None) -> None:
    async with AsyncSessionMaker() as session:
        await resend_service.sync_user(session, user_id, previous_email=previous_email)
