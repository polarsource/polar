import structlog
from pydantic import HttpUrl

from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import Member, MemberSession
from polar.postgres import AsyncSession

from .repository import MemberSessionRepository

log: Logger = structlog.get_logger()

MEMBER_SESSION_TOKEN_PREFIX = "polar_mst_"


class MemberSessionService(ResourceServiceReader[MemberSession]):
    async def create_member_session(
        self,
        session: AsyncSession,
        member: Member,
        return_url: HttpUrl | None = None,
    ) -> tuple[str, MemberSession]:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=MEMBER_SESSION_TOKEN_PREFIX
        )
        member_session = MemberSession(
            token=token_hash,
            member=member,
            return_url=str(return_url) if return_url else None,
        )
        session.add(member_session)
        await session.flush()

        return token, member_session

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> MemberSession | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        repository = MemberSessionRepository.from_session(session)
        return await repository.get_by_token_hash(token_hash, expired=expired)

    async def delete_expired(self, session: AsyncSession) -> None:
        repository = MemberSessionRepository.from_session(session)
        await repository.delete_expired()


member_session = MemberSessionService(MemberSession)
