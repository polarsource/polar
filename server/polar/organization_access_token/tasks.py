import uuid
from datetime import datetime

from polar.worker import AsyncSessionMaker, actor

from .repository import OrganizationAccessTokenRepository


@actor(actor_name="organization_access_token.record_usage")
async def record_usage(
    organization_access_token_id: uuid.UUID, last_used_at: datetime
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationAccessTokenRepository.from_session(session)
        await repository.record_usage(organization_access_token_id, last_used_at)
