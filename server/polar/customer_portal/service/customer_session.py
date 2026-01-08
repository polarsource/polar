import secrets
import string
import uuid
from dataclasses import dataclass
from math import ceil

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.email.react import render_email_template
from polar.email.schemas import CustomerSessionCodeEmail, CustomerSessionCodeProps
from polar.email.sender import enqueue_email
from polar.exceptions import NotPermitted, PolarError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Customer, CustomerSession, CustomerSessionCode, Organization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession

# Prefix for selection tokens (used during customer selection flow)
SELECTION_TOKEN_PREFIX = "polar_msel_"


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


class SelectionTokenInvalidOrExpired(CustomerSessionError):
    def __init__(self) -> None:
        super().__init__(
            "This selection token is invalid or has expired.", status_code=401
        )


class CustomerNotAccessible(CustomerSessionError):
    def __init__(self) -> None:
        super().__init__(
            "You do not have access to this customer.", status_code=403
        )


@dataclass
class AuthenticateSuccess:
    """Result when authentication completes directly (single customer)."""
    token: str
    customer_session: CustomerSession


@dataclass
class CustomerSelectionRequired:
    """Result when member needs to select which customer to log in as."""
    selection_token: str
    email: str  # Member's email for lookup
    organization_id: uuid.UUID
    customers: list[Customer]


AuthenticateResult = AuthenticateSuccess | CustomerSelectionRequired


class CustomerSessionService:
    async def request(
        self, session: AsyncSession, email: str, organization_id: uuid.UUID
    ) -> tuple[CustomerSessionCode, str]:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        customer: Customer | None = None
        otp_email = email  # Email to send OTP to (and store in CustomerSessionCode)

        # Check if member model is enabled
        if organization.feature_settings.get("member_model_enabled", False):
            # Member model: look up by member email
            member_repository = MemberRepository.from_session(session)
            members = await member_repository.find_by_email_in_org(
                session, email=email, organization_id=organization.id
            )
            if members:
                # Use the first member's customer for OTP purposes
                # The authenticate flow handles multiple customers
                customer_repository = CustomerRepository.from_session(session)
                customer = await customer_repository.get_by_id(members[0].customer_id)
                otp_email = email  # Send to member's email
        else:
            # Legacy: look up by customer email
            customer_repository = CustomerRepository.from_session(session)
            customer = await customer_repository.get_by_email_and_organization(
                email, organization.id
            )
            otp_email = customer.email if customer else email

        if customer is None:
            raise CustomerDoesNotExist(email, organization)

        code, code_hash = self._generate_code_hash()

        # Store the input email (member email), not customer.email
        customer_session_code = CustomerSessionCode(
            code=code_hash, email=otp_email, customer=customer
        )
        session.add(customer_session_code)

        return customer_session_code, code

    async def send(
        self,
        session: AsyncSession,
        customer_session_code: CustomerSessionCode,
        code: str,
    ) -> None:
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
                        "email": customer_session_code.email,  # Use stored email (member email)
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
            to_email_addr=customer_session_code.email,  # Send to stored email (member email)
            subject=f"Access your {organization.name} purchases",
            html_content=body,
        )

    async def authenticate(
        self, session: AsyncSession, code: str
    ) -> AuthenticateResult:
        """
        Authenticate a customer session code.

        Returns either:
        - AuthenticateSuccess: If authentication completes (single customer or feature flag off)
        - CustomerSelectionRequired: If member belongs to multiple customers
        """
        code_hash = get_token_hash(code, secret=settings.SECRET)

        statement = (
            select(CustomerSessionCode)
            .where(
                CustomerSessionCode.expires_at > utc_now(),
                CustomerSessionCode.code == code_hash,
            )
            .options(joinedload(CustomerSessionCode.customer).joinedload(Customer.organization))
        )
        result = await session.execute(statement)
        customer_session_code = result.scalar_one_or_none()

        if customer_session_code is None:
            raise CustomerSessionCodeInvalidOrExpired()

        customer = customer_session_code.customer
        organization = customer.organization
        email = customer_session_code.email

        # Mark email as verified if it matches
        if email.lower() == customer.email.lower():
            customer_repository = CustomerRepository.from_session(session)
            await customer_repository.update(
                customer, update_dict={"email_verified": True}
            )

        # Delete the OTP code (single use)
        await session.delete(customer_session_code)

        # Check if member model is enabled
        if not organization.feature_settings.get("member_model_enabled", False):
            # Legacy flow: create session for customer without member
            token, customer_session = await customer_session_service.create_customer_session(
                session, customer
            )
            customer_session.raw_token = token
            return AuthenticateSuccess(token=token, customer_session=customer_session)

        # New member flow: find all members with this email in the organization
        member_repository = MemberRepository.from_session(session)
        members = await member_repository.find_by_email_in_org(
            session, email=email, organization_id=organization.id
        )

        if len(members) == 0:
            # Edge case: feature flag on but no member exists
            # Auto-create owner member for this customer
            member = await member_service.create_owner_member(
                session, customer, organization
            )
            if member is None:
                # Should not happen, but fallback to legacy flow
                token, customer_session = await customer_session_service.create_customer_session(
                    session, customer
                )
                customer_session.raw_token = token
                return AuthenticateSuccess(token=token, customer_session=customer_session)
            members = [member]

        # Get unique customers these members belong to
        customer_ids = list({m.customer_id for m in members})

        if len(customer_ids) == 1:
            # Single customer - create session directly
            member = members[0]
            token, customer_session = await customer_session_service.create_customer_session(
                session, customer, member_id=member.id
            )
            customer_session.raw_token = token
            return AuthenticateSuccess(token=token, customer_session=customer_session)

        # Multiple customers - load customer objects and return selection required
        customer_repository = CustomerRepository.from_session(session)
        customers = await customer_repository.get_by_ids(customer_ids)

        # Generate selection token
        selection_token, _ = generate_token_hash_pair(
            secret=settings.SECRET, prefix=SELECTION_TOKEN_PREFIX
        )

        return CustomerSelectionRequired(
            selection_token=selection_token,
            email=email,
            organization_id=organization.id,
            customers=list(customers),
        )

    async def select_customer(
        self,
        session: AsyncSession,
        selection_token: str,
        customer_id: uuid.UUID,
        email: str,
        organization_id: uuid.UUID,
    ) -> tuple[str, CustomerSession]:
        """
        Complete authentication by selecting a customer.

        The selection_token, email, and organization_id are passed from the frontend
        which received them from the authenticate response.
        """
        # Verify selection token format
        if not selection_token.startswith(SELECTION_TOKEN_PREFIX):
            raise SelectionTokenInvalidOrExpired()

        # Find the member for this email and customer
        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_member_email_and_customer(
            session, email=email, customer_id=customer_id
        )

        if member is None:
            raise CustomerNotAccessible()

        # Verify member belongs to the correct organization
        if member.organization_id != organization_id:
            raise CustomerNotAccessible()

        # Load the customer
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(customer_id)
        if customer is None:
            raise CustomerNotAccessible()

        # Create the session
        token, customer_session = await customer_session_service.create_customer_session(
            session, customer, member_id=member.id
        )
        customer_session.raw_token = token
        return token, customer_session

    async def switch_customer(
        self,
        session: AsyncSession,
        current_session: CustomerSession,
        customer_id: uuid.UUID,
    ) -> tuple[str, CustomerSession]:
        """
        Switch to a different customer within the same member's access.

        Requires the current session to have a member_id.
        """
        if current_session.member_id is None:
            raise NotPermitted("Cannot switch customers without member authentication")

        # Load the current member to get their email
        member_repository = MemberRepository.from_session(session)
        current_member = await member_repository.get_by_id(current_session.member_id)
        if current_member is None:
            raise NotPermitted("Member not found")

        # Find the member record for the target customer
        target_member = await member_repository.get_by_member_email_and_customer(
            session, email=current_member.email, customer_id=customer_id
        )

        if target_member is None:
            raise CustomerNotAccessible()

        # Verify same organization
        if target_member.organization_id != current_member.organization_id:
            raise CustomerNotAccessible()

        # Load the target customer
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(customer_id)
        if customer is None:
            raise CustomerNotAccessible()

        # Create new session for the target customer
        token, customer_session = await customer_session_service.create_customer_session(
            session,
            customer,
            return_url=current_session.return_url,
            member_id=target_member.id,
        )
        customer_session.raw_token = token
        return token, customer_session

    async def list_available_customers(
        self,
        session: AsyncSession,
        current_session: CustomerSession,
    ) -> list[Customer]:
        """
        List all customers the current member can access.
        """
        if current_session.member_id is None:
            # No member - return only the current customer
            return [current_session.customer]

        # Load the current member to get their email
        member_repository = MemberRepository.from_session(session)
        current_member = await member_repository.get_by_id(current_session.member_id)
        if current_member is None:
            return [current_session.customer]

        # Find all members with this email in the organization
        members = await member_repository.find_by_email_in_org(
            session,
            email=current_member.email,
            organization_id=current_member.organization_id,
        )

        if len(members) == 0:
            return [current_session.customer]

        # Load all customers
        customer_ids = [m.customer_id for m in members]
        customer_repository = CustomerRepository.from_session(session)
        customers = await customer_repository.get_by_ids(customer_ids)
        return list(customers)

    def _generate_code_hash(self) -> tuple[str, str]:
        code = "".join(
            secrets.choice(string.ascii_uppercase + string.digits)
            for _ in range(settings.CUSTOMER_SESSION_CODE_LENGTH)
        )
        code_hash = get_token_hash(code, secret=settings.SECRET)
        return code, code_hash


customer_session = CustomerSessionService()
