import uuid
from math import ceil

from reauth.authentication_session import AuthenticationSession
from reauth.factors.email_otp import EmailOTP as EmailOTPDataclass
from reauth.factors.email_otp import EmailOTPEnrollment
from reauth.factors.email_otp import EmailOTPFactor as EmailOTPFactorBase
from sqlalchemy import delete, select

from polar.config import settings
from polar.kit.crypto import get_legacy_secret
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.models import CustomerSessionEmailOTP
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession

from ..service.customer_session import OrganizationDoesNotExist
from ..service.customer_session import customer_session as customer_session_service


class CustomerSessionEmailOTPFactor(EmailOTPFactorBase):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        super().__init__(
            hash_secret=get_legacy_secret(),
            code_length=settings.CUSTOMER_SESSION_CODE_LENGTH,
            lifetime=settings.CUSTOMER_SESSION_CODE_TTL,
        )

    async def get_enrollment(self, identity_id: uuid.UUID) -> EmailOTPEnrollment | None:
        member_repository = MemberRepository.from_session(self.session)
        member = await member_repository.get_by_id(identity_id)
        if member is None:
            return None
        return EmailOTPEnrollment(
            id=member.id, email=member.email, identity_id=identity_id
        )

    async def insert(self, email_otp: EmailOTPDataclass) -> uuid.UUID:
        email_otp_orm = CustomerSessionEmailOTP(
            code_hash=email_otp.code_hash,
            expires_at=email_otp.expires_at,
            email=email_otp.email,
            identity_id=email_otp.identity_id,
            authentication_session_id=email_otp.authentication_session_id,
        )
        self.session.add(email_otp_orm)
        await self.session.flush()
        return email_otp_orm.id

    async def get_by_code_hash_and_authentication_session_id(
        self, code_hash: str, authentication_session_id: uuid.UUID
    ) -> EmailOTPDataclass | None:
        statement = select(CustomerSessionEmailOTP).where(
            CustomerSessionEmailOTP.code_hash == code_hash,
            CustomerSessionEmailOTP.authentication_session_id
            == authentication_session_id,
        )
        result = await self.session.execute(statement)
        email_otp_orm = result.scalar_one_or_none()
        if email_otp_orm is None:
            return None
        return email_otp_orm.to_dataclass()

    async def delete(self, email_otp: EmailOTPDataclass) -> None:
        statement = delete(CustomerSessionEmailOTP).where(
            CustomerSessionEmailOTP.id == email_otp.id
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def delete_by_authentication_session_id(
        self, authentication_session_id: uuid.UUID
    ) -> None:
        statement = delete(CustomerSessionEmailOTP).where(
            CustomerSessionEmailOTP.authentication_session_id
            == authentication_session_id
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def request(
        self,
        email: str,
        customer_id: uuid.UUID | None,
        authentication_session: AuthenticationSession,
    ) -> None:
        assert authentication_session.context is not None
        organization_id = uuid.UUID(authentication_session.context["organization_id"])
        organization_repository = OrganizationRepository.from_session(self.session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        member = await customer_session_service.get_member(
            self.session, email, organization, customer_id
        )
        code, email_otp = await self.create(
            email=member.email,
            authentication_session_id=authentication_session.id,
            identity_id=member.id,
        )

        delta = email_otp.expires_at - int(utc_now().timestamp())
        customer_session_service.send_code(
            organization, email_otp.email, code, ceil(delta / 60)
        )
