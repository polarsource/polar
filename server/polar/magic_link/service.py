import datetime
from math import ceil
from urllib.parse import urlencode

from sqlalchemy import delete
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import MagicLink, User
from polar.postgres import AsyncSession
from polar.user.schemas.user import UserSignupAttribution
from polar.user.service.user import user as user_service

from .schemas import MagicLinkCreate, MagicLinkUpdate

TOKEN_PREFIX = "polar_ml_"


class MagicLinkError(PolarError): ...


class InvalidMagicLink(MagicLinkError):
    def __init__(self) -> None:
        super().__init__("This magic link is invalid or has expired.", status_code=401)


class MagicLinkService(ResourceService[MagicLink, MagicLinkCreate, MagicLinkUpdate]):
    async def request(
        self,
        session: AsyncSession,
        email: str,
        *,
        signup_attribution: UserSignupAttribution | None = None,
        expires_at: datetime.datetime | None = None,
    ) -> tuple[MagicLink, str]:
        user = await user_service.get_by_email(session, email)

        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=TOKEN_PREFIX
        )
        magic_link_create = MagicLinkCreate(
            token_hash=token_hash,
            user_email=email,
            user_id=user.id if user is not None else None,
            expires_at=expires_at,
        )
        if signup_attribution is not None:
            magic_link_create.signup_attribution = signup_attribution

        magic_link = MagicLink(**magic_link_create.model_dump(exclude_unset=True))
        session.add(magic_link)
        await session.flush()

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

        enqueue_email(
            to_email_addr=magic_link.user_email, subject=subject, html_content=body
        )

    async def authenticate(
        self, session: AsyncSession, token: str
    ) -> tuple[User, bool]:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        magic_link = await self._get_valid_magic_link_by_token_hash(session, token_hash)

        if magic_link is None:
            raise InvalidMagicLink()

        signup_attribution = None
        if magic_link.signup_attribution:
            signup_attribution = UserSignupAttribution.model_validate(
                magic_link.signup_attribution
            )

        is_signup = False
        user = magic_link.user
        if user is None:
            user, is_signup = await user_service.get_by_email_or_create(
                session,
                magic_link.user_email,
                signup_attribution=signup_attribution,
            )

        # Mark email as verified & set is_signup for the first time programmatic
        # users from orders, subscriptions & pledges signin (unverified before).
        if not user.email_verified:
            is_signup = True
            user.email_verified = True
            session.add(user)

        await session.delete(magic_link)

        return (user, is_signup)

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(MagicLink).where(MagicLink.expires_at < utc_now())
        await session.execute(statement)

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
