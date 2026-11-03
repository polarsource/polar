import uuid
from dataclasses import dataclass

import structlog

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.email.schemas import CustomerSessionCodeEmail, CustomerSessionCodeProps
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import (
    Member,
    Organization,
)
from polar.postgres import AsyncSession

log = structlog.get_logger()


@dataclass
class CustomerOption:
    """Minimal customer info for disambiguation."""

    id: uuid.UUID
    name: str | None


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


class CustomerSelectionRequired(CustomerSessionError):
    """Raised when multiple customers match the email and selection is needed."""

    def __init__(self, customers: list[CustomerOption]) -> None:
        self.customers = customers
        super().__init__(
            "Multiple customers found for this email. Please select one.",
            status_code=409,
        )


class CustomerSessionService:
    async def get_member(
        self,
        session: AsyncSession,
        email: str,
        organization: Organization,
        customer_id: uuid.UUID | None,
    ) -> Member:
        """
        Member-based lookup with disambiguation.

        Looks up members by email and handles the case where multiple members
        share the same email.
        """
        member_repository = MemberRepository.from_session(session)
        members = await member_repository.list_by_email_and_organization(
            email, organization.id
        )

        if not members:
            # Try to find customer and auto-create owner member
            customer_repository = CustomerRepository.from_session(session)
            customer = await customer_repository.get_by_email_and_organization(
                email, organization.id
            )
            if customer is not None:
                member = await member_service.create_owner_member(
                    session, customer, organization
                )
                if member is not None:
                    member.customer = customer
                    members = [member]

        if not members:
            raise CustomerDoesNotExist(email, organization)

        if customer_id is not None:
            target_member = next(
                (m for m in members if m.customer_id == customer_id), None
            )
            if target_member is None:
                raise CustomerDoesNotExist(email, organization)
            return target_member

        if len(members) == 1:
            return members[0]

        customer_options = [
            CustomerOption(id=m.customer.id, name=m.customer.name) for m in members
        ]
        raise CustomerSelectionRequired(customer_options)

    def send_code(
        self,
        organization: Organization,
        email: str,
        code: str,
        code_lifetime_minutes: int,
    ) -> None:
        domain = settings.frontend_hostname

        # Recipient is the login email (member.email in the member flow); the
        # customer record may have no email (team customer) or a billing one.
        enqueue_email_template(
            CustomerSessionCodeEmail(
                props=CustomerSessionCodeProps.model_validate(
                    {
                        "email": email,
                        "organization": organization,
                        "code": code,
                        "code_lifetime_minutes": code_lifetime_minutes,
                        "url": settings.generate_frontend_url(
                            f"/{organization.slug}/portal/authenticate"
                        ),
                        "domain": domain,
                    }
                )
            ),
            **organization.email_from_reply,
            to_email_addr=email,
            subject=f"Access your {organization.name} purchases",
        )

        if settings.is_development():
            log.info(
                "\n"
                "╔══════════════════════════════════════════════════════════╗\n"
                "║                                                          ║\n"
                f"║           🔑 CUSTOMER SESSION CODE: {code}              ║\n"
                "║                                                          ║\n"
                "╚══════════════════════════════════════════════════════════╝"
            )


customer_session = CustomerSessionService()
