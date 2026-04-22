from math import ceil

import structlog

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.email.schemas import (
    CustomerEmailChangedNotificationEmail,
    CustomerEmailChangedNotificationProps,
    CustomerEmailUpdateVerificationEmail,
    CustomerEmailUpdateVerificationProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.utils import utc_now
from polar.member.service import member_service
from polar.models import Customer, Organization
from polar.models.customer import CustomerType
from polar.models.customer_email_verification import CustomerEmailVerification
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import CustomerEmailVerificationRepository

log = structlog.get_logger()

TOKEN_PREFIX = "polar_cev_"


class CustomerEmailUpdateError(PolarError): ...


class InvalidCustomerEmailUpdate(CustomerEmailUpdateError):
    def __init__(self) -> None:
        super().__init__(
            "This email update request is invalid or has expired.", status_code=401
        )


class CustomerEmailUpdateService:
    async def request_email_update(
        self,
        session: AsyncSession,
        customer: Customer,
        new_email: str,
    ) -> tuple[CustomerEmailVerification, str]:
        customer_type = customer.type or CustomerType.individual
        if customer_type == CustomerType.team:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "Only individual customers can change their email.",
                        "input": new_email,
                    }
                ]
            )

        if customer.email is not None and customer.email.lower() == new_email.lower():
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "New email is the same as your current email.",
                        "input": new_email,
                    }
                ]
            )

        repository = CustomerEmailVerificationRepository.from_session(session)

        # Delete any existing pending verification for this customer
        await repository.delete_by_customer_id(customer.id)

        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=TOKEN_PREFIX
        )
        record = CustomerEmailVerification(
            email=new_email,
            token_hash=token_hash,
            customer_id=customer.id,
            organization_id=customer.organization_id,
        )
        await repository.create(record, flush=True)

        return record, token

    async def send_verification_email(
        self,
        record: CustomerEmailVerification,
        token: str,
        organization: Organization,
    ) -> None:
        delta = record.expires_at - utc_now()
        token_lifetime_minutes = int(ceil(delta.total_seconds() / 60))

        url = (
            f"{settings.FRONTEND_BASE_URL}"
            f"/{organization.slug}/portal/verify-email?token={token}"
        )
        enqueue_email_template(
            CustomerEmailUpdateVerificationEmail(
                props=CustomerEmailUpdateVerificationProps(
                    email=record.email,
                    organization_name=organization.name,
                    token_lifetime_minutes=token_lifetime_minutes,
                    url=url,
                )
            ),
            to_email_addr=record.email,
            subject="Verify your new email address",
        )

    async def check_token(self, session: AsyncReadSession, token: str) -> bool:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        repository = CustomerEmailVerificationRepository.from_session(session)
        record = await repository.get_valid_by_token_hash(token_hash)
        return record is not None

    async def verify(
        self,
        session: AsyncSession,
        token: str,
    ) -> Customer:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        repository = CustomerEmailVerificationRepository.from_session(session)
        record = await repository.get_valid_by_token_hash(token_hash)

        if record is None:
            raise InvalidCustomerEmailUpdate()

        customer = record.customer

        # Check email uniqueness at verification time
        customer_repository = CustomerRepository.from_session(session)
        existing = await customer_repository.get_by_email_and_organization(
            record.email, record.organization_id
        )
        if existing is not None and existing.id != customer.id:
            await session.delete(record)
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "token"),
                        "msg": "This email address is already in use.",
                        "input": record.email,
                    }
                ]
            )

        old_email = customer.email

        await customer_repository.update(
            customer, update_dict={"email": record.email, "email_verified": True}
        )

        await member_service.sync_owner_email(session, customer)

        if customer.stripe_customer_id is not None and customer.email is not None:
            await stripe_service.update_customer(
                customer.stripe_customer_id, email=customer.email
            )

        # Delete the verification record
        await session.delete(record)

        # Send notification to old email
        if old_email is not None:
            organization = customer.organization
            enqueue_email_template(
                CustomerEmailChangedNotificationEmail(
                    props=CustomerEmailChangedNotificationProps(
                        email=old_email,
                        organization_name=organization.name,
                        new_email=record.email,
                    )
                ),
                to_email_addr=old_email,
                subject="Your email address has been changed",
            )

        log.info(
            "customer_email_update.verified",
            customer_id=customer.id,
            old_email=old_email,
            new_email=customer.email,
        )

        return customer

    async def delete_expired(self, session: AsyncSession) -> None:
        repository = CustomerEmailVerificationRepository.from_session(session)
        await repository.delete_expired()


customer_email_update = CustomerEmailUpdateService()
