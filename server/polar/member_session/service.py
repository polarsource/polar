from pydantic import HttpUrl

from polar.kit.crypto import generate_token_hash_pair
from polar.kit.services import ResourceServiceReader
from polar.models import Member, MemberSession
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX
from polar.postgres import AsyncSession

from .repository import MemberSessionRepository


class MemberSessionService(ResourceServiceReader[MemberSession]):
    async def create_member_session(
        self,
        session: AsyncSession,
        member: Member,
        return_url: HttpUrl | None = None,
    ) -> tuple[str, MemberSession]:
        token, token_hash = generate_token_hash_pair(prefix=MEMBER_SESSION_TOKEN_PREFIX)
        member_session = MemberSession(
            token=token_hash,
            token_v2=token_hash,
            member=member,
            return_url=str(return_url) if return_url else None,
        )
        session.add(member_session)
        await session.flush()

        return token, member_session

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> MemberSession | None:
        repository = MemberSessionRepository.from_session(session)
        return await repository.get_by_token(token, expired=expired)

    async def delete_expired(self, session: AsyncSession) -> None:
        repository = MemberSessionRepository.from_session(session)
        await repository.delete_expired()


member_session = MemberSessionService(MemberSession)
