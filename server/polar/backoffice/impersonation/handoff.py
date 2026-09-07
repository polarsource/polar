from uuid import UUID

from pydantic import BaseModel

from polar.config import settings
from polar.exceptions import BadRequest
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.redis import Redis


class ImpersonationHandoff(BaseModel):
    oauth_token_id: UUID
    admin_user_id: UUID
    user_id: UUID
    organization_id: UUID | None


class ImpersonationHandoffService:
    async def create(self, redis: Redis, handoff: ImpersonationHandoff) -> str:
        code, code_hash = generate_token_hash_pair(secret=settings.SECRET)
        await redis.setex(
            f"backoffice:impersonation:{code_hash}", 60, handoff.model_dump_json()
        )
        return code

    async def consume(self, redis: Redis, code: str) -> ImpersonationHandoff:
        if not code.isascii():
            raise BadRequest("Invalid impersonation handoff")
        code_hash = get_token_hash(code, secret=settings.SECRET)
        value = await redis.getdel(f"backoffice:impersonation:{code_hash}")
        if value is None:
            raise BadRequest("Invalid or expired impersonation handoff")
        return ImpersonationHandoff.model_validate_json(value)


impersonation_handoff = ImpersonationHandoffService()
