import typing
import uuid
from math import ceil

import structlog
from fastapi import Depends
from reauth.authentication_session import AuthenticationSession
from reauth.crypto import get_token_hash
from reauth.factors import FactorBase
from reauth.factors.backup_codes import (
    BackupCodesEnrollment as BackupCodesEnrollmentDataclass,
)
from reauth.factors.backup_codes import BackupCodesFactor as BackupCodesFactorBase
from reauth.factors.email_otp import EmailOTP as EmailOTPDataclass
from reauth.factors.email_otp import EmailOTPEnrollment
from reauth.factors.email_otp import EmailOTPFactor as EmailOTPFactorBase
from reauth.factors.totp import TOTPEnrollment as TOTPEnrollmentDataclass
from reauth.factors.totp import TOTPFactor as TOTPFactorBase
from sqlalchemy import delete, select, update

from polar.config import settings
from polar.email.schemas import LoginCodeEmail, LoginCodeProps
from polar.email.sender import enqueue_email_template
from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import BackupCodesEnrollment, EmailOTP, TOTPEnrollment
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session
from polar.sso.repository import OrganizationSSOConnectionRepository
from polar.user.repository import UserRepository

from .oauth2.apple import AppleFactor, get_apple_factor
from .oauth2.github import GitHubFactor, get_github_factor
from .oauth2.google import GoogleFactor, get_google_factor
from .oauth2.state import OAuth2StateService, get_oauth2_state_service
from .sso.factor import build_sso_factor

if typing.TYPE_CHECKING:
    from .schemas import EmailOTPRequest

log: Logger = structlog.get_logger()


class EmailOTPFactor(EmailOTPFactorBase):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        super().__init__(
            hash_secret=settings.SECRET,
            code_length=settings.EMAIL_OTP_CODE_LENGTH,
            lifetime=settings.EMAIL_OTP_TTL,
        )

    async def get_enrollment(self, identity_id: uuid.UUID) -> EmailOTPEnrollment | None:
        user_repository = UserRepository.from_session(self.session)
        user = await user_repository.get_by_id(identity_id)
        if user is None:
            return None
        return EmailOTPEnrollment(id=user.id, email=user.email, identity_id=identity_id)

    async def insert(self, email_otp: EmailOTPDataclass) -> uuid.UUID:
        email_otp_orm = EmailOTP(
            code_hash=email_otp.code_hash,
            expires_at=email_otp.expires_at,
            email=email_otp.email,
            identity_id=email_otp.identity_id,
            authentication_session_id=email_otp.authentication_session_id,
        )
        self.session.add(email_otp_orm)
        await self.session.flush()
        return email_otp_orm.id

    async def update(self, email_otp: EmailOTPDataclass) -> None:
        statement = (
            update(EmailOTP)
            .where(EmailOTP.id == email_otp.id)
            .values(
                code_hash=email_otp.code_hash,
                expires_at=email_otp.expires_at,
                email=email_otp.email,
                identity_id=email_otp.identity_id,
                authentication_session_id=email_otp.authentication_session_id,
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def get_by_code_hash_and_authentication_session_id(
        self, code_hash: str, authentication_session_id: uuid.UUID
    ) -> EmailOTPDataclass | None:
        statement = select(EmailOTP).where(
            EmailOTP.code_hash == code_hash,
            EmailOTP.authentication_session_id == authentication_session_id,
        )
        result = await self.session.execute(statement)
        login_code_orm = result.scalar_one_or_none()
        if login_code_orm is None:
            return None
        return login_code_orm.to_dataclass()

    async def delete(self, email_otp: EmailOTPDataclass) -> None:
        statement = delete(EmailOTP).where(EmailOTP.id == email_otp.id)
        await self.session.execute(statement)
        await self.session.flush()

    async def delete_by_authentication_session_id(
        self, authentication_session_id: uuid.UUID
    ) -> None:
        statement = delete(EmailOTP).where(
            EmailOTP.authentication_session_id == authentication_session_id
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def request(
        self, request: "EmailOTPRequest", authentication_session: AuthenticationSession
    ) -> None:
        user_repository = UserRepository.from_session(self.session)
        user = await user_repository.get_by_email(request.email)
        signup = user is None

        code, email_otp = await self.create(
            identity_id=user.id if user else None,
            email=request.email,
            authentication_session_id=authentication_session.id,
        )

        if (
            email_otp.email == settings.APP_REVIEW_EMAIL
            and settings.APP_REVIEW_OTP_CODE is not None
        ):
            log.info("App review login, hard-coding OTP code")
            code = settings.APP_REVIEW_OTP_CODE
            email_otp.code_hash = get_token_hash(code, secret=self.hash_secret)
            await self.update(email_otp)

        delta = email_otp.expires_at - int(utc_now().timestamp())
        code_lifetime_minutes = int(ceil(delta / 60))

        domain = settings.frontend_hostname
        subject = "Sign up to Polar" if signup else "Sign in to Polar"
        enqueue_email_template(
            LoginCodeEmail(
                props=LoginCodeProps(
                    email=email_otp.email,
                    code=code,
                    code_lifetime_minutes=code_lifetime_minutes,
                    domain=domain,
                )
            ),
            to_email_addr=email_otp.email,
            subject=subject,
        )

        if settings.is_development():
            log.info(
                "\n"
                "╔══════════════════════════════════════════════════════════╗\n"
                "║                                                          ║\n"
                f"║                   🔑 LOGIN CODE: {code}                  ║\n"
                "║                                                          ║\n"
                "╚══════════════════════════════════════════════════════════╝"
            )


class TOTPFactor(TOTPFactorBase):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        super().__init__()

    async def get_by_identity_id(
        self, identity_id: uuid.UUID
    ) -> TOTPEnrollmentDataclass | None:
        statement = select(TOTPEnrollment).where(
            TOTPEnrollment.identity_id == identity_id
        )
        result = await self.session.execute(statement)
        totp_orm = result.scalar_one_or_none()
        if totp_orm is None:
            return None
        return totp_orm.to_dataclass()

    async def insert(self, totp: TOTPEnrollmentDataclass) -> uuid.UUID:
        totp_orm = TOTPEnrollment(
            enabled=totp.enabled,
            secret=totp.secret,
            algorithm=totp.algorithm,
            code_length=totp.code_length,
            time_step=totp.time_step,
            last_verified_time_step=totp.last_verified_time_step,
            identity_id=totp.identity_id,
        )
        self.session.add(totp_orm)
        await self.session.flush()
        return totp_orm.id

    async def update(self, totp: TOTPEnrollmentDataclass) -> None:
        statement = (
            update(TOTPEnrollment)
            .where(TOTPEnrollment.id == totp.id)
            .values(
                enabled=totp.enabled,
                algorithm=totp.algorithm,
                code_length=totp.code_length,
                time_step=totp.time_step,
                last_verified_time_step=totp.last_verified_time_step,
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def delete(self, totp: TOTPEnrollmentDataclass) -> None:
        statement = delete(TOTPEnrollment).where(TOTPEnrollment.id == totp.id)
        await self.session.execute(statement)
        await self.session.flush()


class BackupCodesFactor(BackupCodesFactorBase):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        super().__init__(hash_secret=settings.SECRET)

    async def get_enrollment(
        self, identity_id: typing.Any
    ) -> BackupCodesEnrollmentDataclass | None:
        statement = select(BackupCodesEnrollment).where(
            BackupCodesEnrollment.identity_id == identity_id
        )
        result = await self.session.execute(statement)
        backup_codes_orm = result.scalar_one_or_none()
        if backup_codes_orm is None:
            return None
        return backup_codes_orm.to_dataclass()

    async def insert(self, backup_codes: BackupCodesEnrollmentDataclass) -> uuid.UUID:
        backup_codes_orm = BackupCodesEnrollment(
            identity_id=backup_codes.identity_id,
            codes_hashes=backup_codes.codes_hashes,
            used_codes_hashes=backup_codes.used_codes_hashes,
        )
        self.session.add(backup_codes_orm)
        await self.session.flush()
        return backup_codes_orm.id

    async def update(self, backup_codes: BackupCodesEnrollmentDataclass) -> None:
        statement = (
            update(BackupCodesEnrollment)
            .where(BackupCodesEnrollment.id == backup_codes.id)
            .values(
                used_codes_hashes=backup_codes.used_codes_hashes,
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def delete(self, backup_codes: BackupCodesEnrollmentDataclass) -> None:
        statement = delete(BackupCodesEnrollment).where(
            BackupCodesEnrollment.id == backup_codes.id
        )
        await self.session.execute(statement)
        await self.session.flush()


async def get_email_otp_factor(
    session: AsyncSession = Depends(get_db_session),
) -> EmailOTPFactor:
    return EmailOTPFactor(session)


async def get_totp_factor(
    session: AsyncSession = Depends(get_db_session),
) -> TOTPFactor:
    return TOTPFactor(session)


async def get_backup_codes_factor(
    session: AsyncSession = Depends(get_db_session),
) -> BackupCodesFactor:
    return BackupCodesFactor(session)


async def get_factors(
    email_otp_factor: EmailOTPFactor = Depends(get_email_otp_factor),
    totp_factor: TOTPFactor = Depends(get_totp_factor),
    backup_codes_factor: BackupCodesFactor = Depends(get_backup_codes_factor),
    apple_factor: AppleFactor = Depends(get_apple_factor),
    github_factor: GitHubFactor = Depends(get_github_factor),
    google_factor: GoogleFactor = Depends(get_google_factor),
) -> set[FactorBase[typing.Any]]:
    return {
        email_otp_factor,
        totp_factor,
        backup_codes_factor,
        apple_factor,
        github_factor,
        google_factor,
    }


async def get_org_factors(
    slug: str,
    base_factors: set[FactorBase[typing.Any]] = Depends(get_factors),
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> set[FactorBase[typing.Any]]:
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_slug(slug)
    if organization is None:
        raise ResourceNotFound()

    sso_repository = OrganizationSSOConnectionRepository.from_session(session)
    connections = await sso_repository.get_enabled_by_organization(organization.id)

    return base_factors | {
        build_sso_factor(
            connection,
            organization_slug=organization.slug,
            state_service=state_service,
        )
        for connection in connections
    }
