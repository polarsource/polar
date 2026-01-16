import secrets
import string
import uuid
from dataclasses import dataclass
from math import ceil

import structlog
from sqlalchemy import select

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.email.react import render_email_template
from polar.email.schemas import CustomerSessionCodeEmail, CustomerSessionCodeProps
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.member_session.service import member_session as member_session_service
from polar.models import (
    CustomerSession,
    CustomerSessionCode,
    MemberSession,
    Organization,
)
from polar.organization.repository import OrganizationRepository
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
    async def request(
        self,
        session: AsyncSession,
        email: str,
        organization_id: uuid.UUID,
        customer_id: uuid.UUID | None = None,
    ) -> tuple[CustomerSessionCode, str]:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        member_model_enabled = organization.feature_settings.get(
            "member_model_enabled", False
        )

        if member_model_enabled:
            customer_session_code, code = await self._request_with_member_lookup(
                session, email, organization, customer_id
            )
        else:
            customer_session_code, code = await self._request_with_customer_lookup(
                session, email, organization
            )

        session.add(customer_session_code)
        return customer_session_code, code

    async def _request_with_member_lookup(
        self,
        session: AsyncSession,
        email: str,
        organization: Organization,
        customer_id: uuid.UUID | None,
    ) -> tuple[CustomerSessionCode, str]:
        """
        Member-based lookup with disambiguation for migrated orgs.

        Used when member_model_enabled=true. Looks up members by email and
        handles the case where multiple members share the same email.
        """
        member_repository = MemberRepository.from_session(session)
        members = await member_repository.list_by_email_and_organization(
            email, organization.id
        )

        if not members:
            raise CustomerDoesNotExist(email, organization)

        if customer_id is not None:
            target_member = next(
                (m for m in members if m.customer_id == customer_id), None
            )
            if target_member is None:
                raise CustomerDoesNotExist(email, organization)
            member = target_member
        elif len(members) == 1:
            member = members[0]
        else:
            customer_options = [
                CustomerOption(id=m.customer.id, name=m.customer.name) for m in members
            ]
            raise CustomerSelectionRequired(customer_options)

        code, code_hash = self._generate_code_hash()
        customer_session_code = CustomerSessionCode(
            code=code_hash, email=member.email, customer=member.customer
        )
        return customer_session_code, code

    async def _request_with_customer_lookup(
        self,
        session: AsyncSession,
        email: str,
        organization: Organization,
    ) -> tuple[CustomerSessionCode, str]:
        """
        Legacy customer-based lookup for non-migrated orgs.

        Used when member_model_enabled=false. Looks up customers directly
        by email since members don't exist for this organization yet.
        """
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_email_and_organization(
            email, organization.id
        )

        if customer is None:
            raise CustomerDoesNotExist(email, organization)

        code, code_hash = self._generate_code_hash()
        customer_session_code = CustomerSessionCode(
            code=code_hash, email=email, customer=customer
        )
        return customer_session_code, code

    async def send(
        self,
        session: AsyncSession,
        customer_session_code: CustomerSessionCode,
        code: str,
    ) -> None:
        customer = customer_session_code.customer
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            customer_session_code.customer.organization_id
        )
        assert organization is not None

        delta = customer_session_code.expires_at - utc_now()
        code_lifetime_minutes = int(ceil(delta.seconds / 60))

        body = render_email_template(
            CustomerSessionCodeEmail(
                props=CustomerSessionCodeProps.model_validate(
                    {
                        "email": customer.email,
                        "organization": organization,
                        "code": code,
                        "code_lifetime_minutes": code_lifetime_minutes,
                        "url": settings.generate_frontend_url(
                            f"/{organization.slug}/portal/authenticate"
                        ),
                    }
                )
            )
        )

        enqueue_email(
            **organization.email_from_reply,
            to_email_addr=customer.email,
            subject=f"Access your {organization.name} purchases",
            html_content=body,
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

    async def authenticate(
        self, session: AsyncSession, code: str
    ) -> tuple[str, CustomerSession | MemberSession]:
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

        organization = customer.organization

        # For orgs with member_model_enabled, create MemberSession instead
        if organization.feature_settings.get("member_model_enabled", False):
            member_repository = MemberRepository.from_session(session)

            # Look up member by (customer, email) - unique combination
            member = await member_repository.get_by_customer_and_email(
                session, customer, customer_session_code.email
            )

            if member is None:
                # Fallback to owner if member not found (edge case)
                member = await member_repository.get_owner_by_customer_id(
                    session, customer.id
                )

            if member:
                # Use create_member_session directly (not create() which checks seat_based_pricing)
                return await member_session_service.create_member_session(
                    session, member
                )

        # Legacy: create CustomerSession
        return await customer_session_service.create_customer_session(
            session, customer
        )

    def _generate_code_hash(self) -> tuple[str, str]:
        code = "".join(
            secrets.choice(string.ascii_uppercase + string.digits)
            for _ in range(settings.CUSTOMER_SESSION_CODE_LENGTH)
        )
        code_hash = get_token_hash(code, secret=settings.SECRET)
        return code, code_hash


customer_session = CustomerSessionService()
