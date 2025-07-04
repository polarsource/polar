import datetime
import secrets
import string
from math import ceil

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import LoginCode, User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.user.schemas import UserSignupAttribution
from polar.user.service import user as user_service


class LoginCodeError(PolarError): ...


class LoginCodeInvalidOrExpired(LoginCodeError):
    def __init__(self) -> None:
        super().__init__("This login code is invalid or has expired.", status_code=401)


class LoginCodeService:
    async def request(
        self,
        session: AsyncSession,
        email: str,
        *,
        return_to: str | None = None,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[LoginCode, str]:
        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_email(email)

        code, code_hash = self._generate_code_hash()

        login_code = LoginCode(
            code_hash=code_hash,
            email=email,
            user_id=user.id if user is not None else None,
            expires_at=utc_now()
            + datetime.timedelta(seconds=settings.LOGIN_CODE_TTL_SECONDS),
            return_to=return_to,
        )
        session.add(login_code)
        await session.flush()

        return login_code, code

    async def send(
        self,
        login_code: LoginCode,
        code: str,
    ) -> None:
        delta = login_code.expires_at - utc_now()
        code_lifetime_minutes = int(ceil(delta.seconds / 60))

        subject = "Sign in to Polar"
        body = render_email_template(
            "login_code",
            {
                "code": code,
                "code_lifetime_minutes": code_lifetime_minutes,
                "current_year": datetime.datetime.now().year,
            },
        )

        enqueue_email(
            to_email_addr=login_code.email, subject=subject, html_content=body
        )

    async def authenticate(
        self,
        session: AsyncSession,
        code: str,
        *,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool, str | None]:
        code_hash = get_token_hash(code, secret=settings.SECRET)

        statement = (
            select(LoginCode)
            .where(LoginCode.code_hash == code_hash, LoginCode.expires_at > utc_now())
            .options(joinedload(LoginCode.user))
        )
        result = await session.execute(statement)
        login_code = result.scalar_one_or_none()

        if login_code is None:
            raise LoginCodeInvalidOrExpired()

        is_signup = False
        user = login_code.user
        if user is None:
            user, is_signup = await user_service.get_by_email_or_create(
                session,
                login_code.email,
                signup_attribution=signup_attribution,
            )

        # Mark email as verified
        if not user.email_verified:
            is_signup = True
            user.email_verified = True
            session.add(user)

        return_to = login_code.return_to
        await session.delete(login_code)

        return user, is_signup, return_to

    def _generate_code_hash(self) -> tuple[str, str]:
        code = "".join(
            secrets.choice(string.ascii_uppercase + string.digits)
            for _ in range(settings.LOGIN_CODE_LENGTH)
        )
        code_hash = get_token_hash(code, secret=settings.SECRET)
        return code, code_hash


login_code = LoginCodeService()
