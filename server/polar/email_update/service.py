import datetime
from math import ceil
from urllib.parse import urlencode

from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.exceptions import PolarError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import EmailVerification
from polar.models.user import User
from polar.postgres import AsyncSession

from .schemas import EmailUpdateCreate

TOKEN_PREFIX = "polar_ev_"


class EmailUpdateError(PolarError): ...


class InvalidEmailUpdate(EmailUpdateError):
    def __init__(self) -> None:
        super().__init__(
            "This email update request is invalid or has expired.", status_code=401
        )


class EmailUpdateService(ResourceServiceReader[EmailVerification]):
    async def request_email_update(
        self,
        email: str,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        expire_at: datetime.datetime | None = None,
    ) -> tuple[EmailVerification, str]:
        user = auth_subject.subject
        user_id = user.id
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=TOKEN_PREFIX
        )
        email_update_create = EmailUpdateCreate(
            email=email, token_hash=token_hash, expires_at=expire_at, user_id=user_id
        )

        email_update_record = EmailVerification(
            **email_update_create.model_dump(exclude_unset=True)
        )

        session.add(email_update_record)
        await session.flush()

        return email_update_record, token

    async def send_email(
        self,
        email_update_record: EmailVerification,
        token: str,
        base_url: str,
        *,
        extra_url_params: dict[str, str] = {},
    ) -> None:
        email_renderer = get_email_renderer({"email_update": "polar.email_update"})
        email_sender = get_email_sender()

        delta = email_update_record.expires_at - utc_now()
        token_lifetime_minutes = int(ceil(delta.seconds / 60))

        url_params = {"token": token, **extra_url_params}
        subject, body = email_renderer.render_from_template(
            "Update your email",
            "email_update/email_update.html",
            {
                "token_lifetime_minutes": token_lifetime_minutes,
                "url": f"{base_url}?{urlencode(url_params)}",
                "current_year": datetime.datetime.now().year,
            },
        )

        email_sender.send_to_user(
            to_email_addr=email_update_record.email, subject=subject, html_content=body
        )

    async def verify(self, session: AsyncSession, token: str) -> User:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        email_update_record = await self._get_email_update_record_by_token_hash(
            session, token_hash
        )

        if email_update_record is None:
            raise InvalidEmailUpdate()

        user = email_update_record.user
        user.email = email_update_record.email

        await session.delete(email_update_record)

        return user

    async def _get_email_update_record_by_token_hash(
        self, session: AsyncSession, token_hash: str
    ) -> EmailVerification | None:
        statement = (
            sql.select(EmailVerification)
            .where(
                EmailVerification.token_hash == token_hash,
                EmailVerification.expires_at > utc_now(),
            )
            .options(joinedload(EmailVerification.user))
        )

        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()


email_update = EmailUpdateService(EmailVerification)
