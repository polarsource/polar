import datetime
import secrets
import string
import uuid
from math import ceil

from sqlalchemy import select

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import CustomerSession, CustomerSessionCode, Organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession


class CustomerSessionError(PolarError): ...


class OrganizationDoesNotExist(CustomerSessionError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization {organization_id} does not exist."
        super().__init__(message)


class CustomerDoesNotExist(CustomerSessionError):
    def __init__(self, email: str, organization: Organization) -> None:
        self.email = email
        self.organization = organization
        message = f"Customer does not exist for email {email} and organization {organization.id}."
        super().__init__(message)


class CustomerSessionCodeInvalidOrExpired(CustomerSessionError):
    def __init__(self) -> None:
        super().__init__(
            "This customer session code is invalid or has expired.", status_code=401
        )


class CustomerSessionService:
    async def request(
        self, session: AsyncSession, email: str, organization_id: uuid.UUID
    ) -> tuple[CustomerSessionCode, str]:
        organization = await organization_service.get(session, organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        repository = CustomerRepository.from_session(session)
        customer = await repository.get_by_email_and_organization(
            email, organization.id
        )
        if customer is None:
            raise CustomerDoesNotExist(email, organization)

        code, code_hash = self._generate_code_hash()

        customer_session_code = CustomerSessionCode(
            code=code_hash, email=customer.email, customer=customer
        )
        session.add(customer_session_code)

        return customer_session_code, code

    async def send(
        self,
        session: AsyncSession,
        customer_session_code: CustomerSessionCode,
        code: str,
    ) -> None:
        email_renderer = get_email_renderer(
            {"customer_portal": "polar.customer_portal"}
        )

        customer = customer_session_code.customer
        organization = await organization_service.get(
            session, customer_session_code.customer.organization_id
        )
        assert organization is not None

        delta = customer_session_code.expires_at - utc_now()
        code_lifetime_minutes = int(ceil(delta.seconds / 60))

        subject, body = email_renderer.render_from_template(
            f"Access your {organization.name} purchases",
            "customer_portal/customer_session_code.html",
            {
                "featured_organization": organization,
                "code": code,
                "code_lifetime_minutes": code_lifetime_minutes,
                "url": settings.generate_frontend_url(
                    f"/{organization.slug}/portal/authenticate"
                ),
                "current_year": datetime.datetime.now().year,
            },
        )

        enqueue_email(to_email_addr=customer.email, subject=subject, html_content=body)

    async def authenticate(
        self, session: AsyncSession, code: str
    ) -> tuple[str, CustomerSession]:
        code_hash = get_token_hash(code, secret=settings.SECRET)

        statement = select(CustomerSessionCode).where(
            CustomerSessionCode.expires_at > utc_now(),
            CustomerSessionCode.code == code_hash,
        )
        result = await session.execute(statement)
        customer_session_code = result.scalar_one_or_none()

        if customer_session_code is None:
            raise CustomerSessionCodeInvalidOrExpired()

        customer = customer_session_code.customer
        if customer_session_code.email.lower() == customer.email.lower():
            customer_repository = CustomerRepository.from_session(session)
            await customer_repository.update(
                customer, update_dict={"email_verified": True}
            )

        await session.delete(customer_session_code)

        return await customer_session_service.create_customer_session(
            session, customer_session_code.customer
        )

    def _generate_code_hash(self) -> tuple[str, str]:
        code = "".join(
            secrets.choice(string.ascii_uppercase + string.digits)
            for _ in range(settings.CUSTOMER_SESSION_CODE_LENGTH)
        )
        code_hash = get_token_hash(code, secret=settings.SECRET)
        return code, code_hash


customer_session = CustomerSessionService()
