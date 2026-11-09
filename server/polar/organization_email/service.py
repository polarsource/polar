import hmac
import secrets
import string
from datetime import timedelta

from polar.config import settings
from polar.email.schemas import (
    OrganizationEmailVerificationEmail,
    OrganizationEmailVerificationProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash, get_token_hash_candidates
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationEmail
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationEmailRepository
from .schemas import OrganizationEmailStatus

CODE_LENGTH = 6
CODE_ALPHABET = string.ascii_uppercase + string.digits


class OrganizationEmailMissing(PolarError):
    def __init__(self) -> None:
        super().__init__("The organization has no support email to verify.", 409)


class InvalidVerificationCode(PolarError):
    def __init__(self) -> None:
        super().__init__("This code is invalid or has expired.", 400)


class SupportEmailNotVerified(PolarError):
    def __init__(self) -> None:
        super().__init__("The support email must be verified first.", 403)


class OrganizationEmailService:
    async def get_current(
        self, session: AsyncReadSession, organization: Organization
    ) -> OrganizationEmail | None:
        repository = OrganizationEmailRepository.from_session(session)
        return await repository.get_latest_by_organization(organization.id)

    async def is_verified(
        self, session: AsyncReadSession, organization: Organization
    ) -> bool:
        return self.get_status(
            organization, await self.get_current(session, organization)
        ).verified

    def get_status(
        self, organization: Organization, current: OrganizationEmail | None
    ) -> OrganizationEmailStatus:
        if current is None or current.email != organization.email:
            return OrganizationEmailStatus(
                email=organization.email, verified=False, code_pending=False
            )
        return OrganizationEmailStatus(
            email=organization.email,
            verified=current.verified_at is not None,
            code_pending=(
                current.verified_at is None
                and current.code_hash is not None
                and current.expires_at is not None
                and current.expires_at > utc_now()
            ),
        )

    async def assert_verified(
        self, session: AsyncReadSession, organization: Organization
    ) -> None:
        if not await self.is_verified(session, organization):
            raise SupportEmailNotVerified()

    async def track_change(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationEmail | None:
        if organization.email is None:
            return None
        repository = OrganizationEmailRepository.from_session(session)
        return await repository.create(
            OrganizationEmail(organization=organization, email=organization.email)
        )

    async def send_code(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationEmail:
        if organization.email is None:
            raise OrganizationEmailMissing()

        repository = OrganizationEmailRepository.from_session(session)
        current = await repository.get_latest_by_organization(organization.id)
        if current is not None and current.email == organization.email:
            if current.verified_at is not None:
                return current
        else:
            current = await repository.create(
                OrganizationEmail(organization=organization, email=organization.email)
            )

        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        code_hash = get_token_hash(code)
        lifetime = timedelta(seconds=settings.EMAIL_VERIFICATION_TTL_SECONDS)
        current = await repository.update(
            current,
            update_dict={"code_hash": code_hash, "expires_at": utc_now() + lifetime},
        )

        enqueue_email_template(
            OrganizationEmailVerificationEmail(
                props=OrganizationEmailVerificationProps(
                    email=organization.email,
                    code=code,
                    code_lifetime_minutes=int(lifetime.total_seconds() // 60),
                    organization_name=organization.name,
                )
            ),
            to_email_addr=organization.email,
            subject=f"Your code to verify the support email of {organization.name}",
        )
        return current

    async def verify(
        self, session: AsyncSession, organization: Organization, code: str
    ) -> OrganizationEmail:
        repository = OrganizationEmailRepository.from_session(session)
        current = await repository.get_latest_by_organization(organization.id)
        if (
            current is None
            or current.email != organization.email
            or current.code_hash is None
            or current.expires_at is None
            or current.expires_at < utc_now()
        ):
            raise InvalidVerificationCode()

        candidates = get_token_hash_candidates(code.strip().upper()).values()
        if not any(hmac.compare_digest(current.code_hash, c) for c in candidates):
            raise InvalidVerificationCode()

        return await repository.update(
            current,
            update_dict={
                "verified_at": utc_now(),
                "code_hash": None,
                "expires_at": None,
            },
        )


organization_email = OrganizationEmailService()
