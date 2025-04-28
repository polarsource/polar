import uuid
from datetime import datetime

from polar.worker import AsyncSessionMaker, actor

from .service import personal_access_token as personal_access_token_service


@actor(actor_name="personal_access_token.record_usage")
async def record_usage(
    personal_access_token_id: uuid.UUID, last_used_at: datetime
) -> None:
    async with AsyncSessionMaker() as session:
        await personal_access_token_service.record_usage(
            session, personal_access_token_id, last_used_at
        )
