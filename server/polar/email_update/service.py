from math import ceil
from urllib.parse import urlencode

from sqlalchemy import delete

from polar.auth.models import AuthSubject
from polar.email.schemas import EmailUpdateEmail, EmailUpdateProps
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.resend.service import resend as resend_service
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import EmailVerification
from polar.models.user import User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository

from .repository import EmailVerificationRepository

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
    ) -> tuple[EmailVerification, str]:
        user = auth_subject.subject

        user_repository = UserRepository.from_session(session)
        existing_user = await user_repository.get_by_email(email)
        if existing_user is not None and existing_user.id != user.id:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "Another user is already using this email.",
                        "input": email,
                    }
                ]
            )

        token, token_hash = generate_token_hash_pair(prefix=TOKEN_PREFIX)
        email_update_record = EmailVerification(
            email=email, token_hash=token_hash, user=user
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
        extra_url_params: dict[str, str] | None = None,
    ) -> None:
        if extra_url_params is None:
            extra_url_params = {}
        delta = email_update_record.expires_at - utc_now()
        token_lifetime_minutes = ceil(delta.seconds / 60)

        email = email_update_record.email
        url_params = {"token": token, **extra_url_params}
        enqueue_email_template(
            EmailUpdateEmail(
                props=EmailUpdateProps(
                    email=email,
                    token_lifetime_minutes=token_lifetime_minutes,
                    url=f"{base_url}?{urlencode(url_params)}",
                )
            ),
            to_email_addr=email,
            subject="Update your email",
        )

    async def verify(self, session: AsyncSession, token: str, user: User) -> User:
        repository = EmailVerificationRepository.from_session(session)
        email_update_record = await repository.get_by_token(token)

        if email_update_record is None or email_update_record.user_id != user.id:
            raise InvalidEmailUpdate()

        user = email_update_record.user
        previous_email = user.email
        user.email = email_update_record.email
        session.add(user)

        await session.delete(email_update_record)

        resend_service.enqueue_sync_user(user.id, previous_email=previous_email)

        return user

    async def delete_expired_record(self, session: AsyncSession) -> None:
        statement = delete(EmailVerification).where(
            EmailVerification.expires_at < utc_now()
        )
        await session.execute(statement)
        await session.flush()


email_update = EmailUpdateService(EmailVerification)
