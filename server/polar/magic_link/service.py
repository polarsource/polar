from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.kit.services import ResourceService
from polar.models import MagicLink, User
from polar.postgres import AsyncSession
from polar.user.service import user as user_service
from polar.exceptions import PolarError
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.worker import enqueue_job
from .schemas import MagicLinkCreate, MagicLinkRequest, MagicLinkUpdate


class InvalidMagicLink(PolarError):
    def __init__(self) -> None:
        super().__init__("This magic link is invalid or has expired.", status_code=401)


class MagicLinkService(ResourceService[MagicLink, MagicLinkCreate, MagicLinkUpdate]):
    async def request(
        self, session: AsyncSession, magic_link_request: MagicLinkRequest
    ) -> MagicLink:
        user = await user_service.get_by_email(session, magic_link_request.email)

        token, token_hash = generate_token(secret=settings.SECRET)
        magic_link_create = MagicLinkCreate(
            token_hash=token_hash,
            user_email=magic_link_request.email,
            user_id=user.id if user is not None else None,
        )
        magic_link = await self.create(session, magic_link_create)

        await enqueue_job(
            "magic_link.request", magic_link_id=magic_link.id, token=token
        )

        return magic_link

    async def authenticate(self, session: AsyncSession, token: str) -> User:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        magic_link = await self._get_valid_magic_link_by_token_hash(session, token_hash)

        if magic_link is None:
            raise InvalidMagicLink()

        user = magic_link.user
        if user is None:
            user = await user_service.signup_by_email(session, magic_link.user_email)

        await magic_link.delete(session)

        return user

    async def _get_valid_magic_link_by_token_hash(
        self, session: AsyncSession, token_hash: str
    ) -> MagicLink | None:
        statement = (
            sql.select(MagicLink)
            .where(MagicLink.token_hash == token_hash, MagicLink.expires_at > utc_now())
            .options(joinedload(MagicLink.user))
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()


magic_link = MagicLinkService(MagicLink)
