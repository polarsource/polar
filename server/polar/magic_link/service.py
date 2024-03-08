import datetime
from math import ceil
from urllib.parse import urlencode

from sqlalchemy import delete
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.exceptions import PolarError
from polar.kit.crypto import generate_token, get_token_hash
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import MagicLink, User
from polar.postgres import AsyncSession
from polar.user.service import user as user_service

from .schemas import MagicLinkCreate, MagicLinkSource, MagicLinkUpdate


class MagicLinkError(PolarError):
    ...


class InvalidMagicLink(MagicLinkError):
    def __init__(self) -> None:
        super().__init__("This magic link is invalid or has expired.", status_code=401)


class MagicLinkService(ResourceService[MagicLink, MagicLinkCreate, MagicLinkUpdate]):
    async def request(
        self,
        session: AsyncSession,
        email: str,
        *,
        source: MagicLinkSource,
        expires_at: datetime.datetime | None = None,
    ) -> tuple[MagicLink, str]:
        user = await user_service.get_by_email(session, email)

        token, token_hash = generate_token(secret=settings.SECRET)
        magic_link_create = MagicLinkCreate(
            token_hash=token_hash,
            user_email=email,
            user_id=user.id if user is not None else None,
            source=source,
            expires_at=expires_at,
        )
        magic_link = MagicLink(**magic_link_create.model_dump())
        session.add(magic_link)
        await session.commit()

        return magic_link, token

    async def send(
        self,
        magic_link: MagicLink,
        token: str,
        base_url: str,
        *,
        extra_url_params: dict[str, str] = {},
    ) -> None:
        email_renderer = get_email_renderer({"magic_link": "polar.magic_link"})
        email_sender = get_email_sender()

        delta = magic_link.expires_at - utc_now()
        token_lifetime_minutes = int(ceil(delta.seconds / 60))

        url_params = {"token": token, **extra_url_params}
        subject, body = email_renderer.render_from_template(
            "Sign in to Polar",
            "magic_link/magic_link.html",
            {
                "token_lifetime_minutes": token_lifetime_minutes,
                "url": f"{base_url}?{urlencode(url_params)}",
                "current_year": datetime.datetime.now().year,
            },
        )

        email_sender.send_to_user(
            to_email_addr=magic_link.user_email,
            subject=subject,
            html_content=body,
            from_email_addr="noreply@notifications.polar.sh",
        )

    async def authenticate(self, session: AsyncSession, token: str) -> User:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        magic_link = await self._get_valid_magic_link_by_token_hash(session, token_hash)

        if magic_link is None:
            raise InvalidMagicLink()

        user = magic_link.user
        if user is None:
            user = await user_service.get_by_email_or_signup(
                session, magic_link.user_email
            )

        user.email_verified = True
        await user.update(session)

        await magic_link.delete(session)

        return user

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(MagicLink).where(MagicLink.expires_at < utc_now())
        await session.execute(statement)
        await session.commit()

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
