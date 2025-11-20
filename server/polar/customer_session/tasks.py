from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import customer_session as customer_session_service


@actor(
    actor_name="customer_session.delete_expired",
    priority=TaskPriority.LOW,
)
async def customer_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await customer_session_service.delete_expired(session)
