import structlog
from pydantic import HttpUrl
from sqlalchemy import delete, select
from sqlalchemy.orm import contains_eager

from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Member, MemberSession
from polar.models.customer import Customer
from polar.postgres import AsyncSession

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
        statement = (
            select(MemberSession)
            .join(MemberSession.member)
            .join(Member.customer)
            .where(
                MemberSession.token == token_hash,
                MemberSession.deleted_at.is_(None),
                Member.deleted_at.is_(None),
            )
            .options(
                contains_eager(MemberSession.member)
                .contains_eager(Member.customer)
                .joinedload(Customer.organization)
            )
        )
        if not expired:
            statement = statement.where(MemberSession.expires_at > utc_now())

        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(MemberSession).where(MemberSession.expires_at < utc_now())
        await session.execute(statement)


member_session = MemberSessionService(MemberSession)
