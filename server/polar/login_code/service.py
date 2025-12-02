import datetime
import secrets
import string
from math import ceil

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.schemas import LoginCodeEmail, LoginCodeProps
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import LoginCode, User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.user.schemas import UserSignupAttribution
from polar.user.service import user as user_service

log = structlog.get_logger()


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

        email = login_code.email
        subject = "Sign in to Polar"
        body = render_email_template(
            LoginCodeEmail(
                props=LoginCodeProps(
                    email=email,
                    code=code,
                    code_lifetime_minutes=code_lifetime_minutes,
                )
            )
        )

        enqueue_email(to_email_addr=email, subject=subject, html_content=body)

        if settings.is_development():
            log.info(
                "\n"
                "╔══════════════════════════════════════════════════════════╗\n"
                "║                                                          ║\n"
                f"║                   🔑 LOGIN CODE: {code}                  ║\n"
                "║                                                          ║\n"
                "╚══════════════════════════════════════════════════════════╝"
            )

    async def authenticate(
        self,
        session: AsyncSession,
        code: str,
        email: str,
        *,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool]:
        app_review_bypass = await self._try_app_review_bypass(
            session, code, email, signup_attribution
        )
        if app_review_bypass is not None:
            return app_review_bypass

        code_hash = get_token_hash(code, secret=settings.SECRET)

        statement = (
            select(LoginCode)
            .where(
                LoginCode.code_hash == code_hash,
                LoginCode.email == email,
                LoginCode.expires_at > utc_now(),
            )
            .options(joinedload(LoginCode.user))
        )
        result = await session.execute(statement)
        login_code = result.unique().scalar_one_or_none()

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

        await session.delete(login_code)

        return user, is_signup

    async def _try_app_review_bypass(
        self,
        session: AsyncSession,
        code: str,
        email: str,
        signup_attribution: UserSignupAttribution | None,
    ) -> tuple[User, bool] | None:
        if not (settings.APP_REVIEW_EMAIL and settings.APP_REVIEW_OTP_CODE):
            return None

        if email.lower() != settings.APP_REVIEW_EMAIL.lower():
            return None

        if code != settings.APP_REVIEW_OTP_CODE:
            return None

        user, is_signup = await user_service.get_by_email_or_create(
            session,
            email,
            signup_attribution=signup_attribution,
        )
        return user, is_signup

    def _generate_code_hash(self) -> tuple[str, str]:
        code = "".join(
            secrets.choice(string.ascii_uppercase + string.digits)
            for _ in range(settings.LOGIN_CODE_LENGTH)
        )
        code_hash = get_token_hash(code, secret=settings.SECRET)
        return code, code_hash


login_code = LoginCodeService()
