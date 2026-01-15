import structlog
from pydantic import HttpUrl
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.config import settings
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.member.repository import MemberRepository
from polar.models import Customer, Member, MemberSession
from polar.models.member_session import MEMBER_SESSION_TOKEN_PREFIX
from polar.models.organization import Organization as OrganizationModel
from polar.postgres import AsyncSession

from .repository import MemberSessionRepository
from .schemas import MemberSessionCreate

log: Logger = structlog.get_logger()


class MemberSessionService(ResourceServiceReader[MemberSession]):
    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        member_session_create: MemberSessionCreate,
    ) -> MemberSession:
        repository = MemberRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Member.id == member_session_create.member_id)
            .options(
                joinedload(Member.customer).joinedload(Customer.organization),
            )
        )

        member = await repository.get_one_or_none(statement)

        if member is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "member_id"),
                        "msg": "Member does not exist.",
                        "type": "value_error",
                        "input": member_session_create.member_id,
                    }
                ]
            )

        organization: OrganizationModel = member.customer.organization

        required_flags = ["member_model_enabled", "seat_based_pricing_enabled"]
        missing_flags = [
            flag
            for flag in required_flags
            if not organization.feature_settings.get(flag, False)
        ]
        if missing_flags:
            raise NotPermitted(
                f"Member sessions require {', '.join(missing_flags)} to be enabled "
                "for the organization. Use customer sessions instead."
            )

        token, member_session = await self.create_member_session(
            session, member, member_session_create.return_url
        )
        member_session.raw_token = token
        return member_session

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
