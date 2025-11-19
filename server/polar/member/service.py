from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy.exc import IntegrityError

from polar.models.customer import Customer
from polar.models.member import Member, MemberRole
from polar.models.organization import Organization
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import MemberRepository

log = structlog.get_logger()


class MemberService:
    async def create_owner_member(
        self,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
        *,
        owner_email: str | None = None,
        owner_name: str | None = None,
        owner_external_id: str | None = None,
    ) -> Member | None:
        """
        Create an owner member for a customer if feature flag is enabled.

        Args:
            session: Database session
            customer: Customer to create member for
            organization: Organization the customer belongs to
            owner_email: Optional override for member email (defaults to customer.email)
            owner_name: Optional override for member name (defaults to customer.name)
            owner_external_id: Optional override for member external_id (defaults to customer.external_id)

        Returns:
            Created/existing Member if feature flag enabled, None if flag disabled
        """
        if not organization.feature_settings.get("member_model_enabled", False):
            log.debug(
                "member.create_owner_member.skipped",
                reason="feature_flag_disabled",
                customer_id=customer.id,
                organization_id=organization.id,
            )
            return None

        repository = MemberRepository.from_session(session)

        email = owner_email or customer.email
        name = owner_name or customer.name
        external_id = owner_external_id or customer.external_id

        existing_member = await repository.get_by_customer_and_email(
            session, customer, email=email
        )
        if existing_member:
            log.debug(
                "member.create_owner_member.skipped",
                reason="member_already_exists",
                customer_id=customer.id,
                member_id=existing_member.id,
            )
            return existing_member

        member = Member(
            customer_id=customer.id,
            email=email,
            name=name,
            external_id=external_id,
            role=MemberRole.owner,
        )

        try:
            created_member = await repository.create(member)
            log.info(
                "member.create_owner_member.success",
                customer_id=customer.id,
                member_id=created_member.id,
                organization_id=organization.id,
            )
            return created_member
        except IntegrityError as e:
            log.info(
                "member.create_owner_member.constraint_violation",
                customer_id=customer.id,
                organization_id=organization.id,
                error=str(e),
                reason="Likely race condition - member already exists",
            )
            existing_member = await repository.get_by_customer_and_email(
                session, customer, email=email
            )
            if existing_member:
                log.info(
                    "member.create_owner_member.found_existing",
                    customer_id=customer.id,
                    member_id=existing_member.id,
                )
                return existing_member

            # Weird state: IntegrityError but member doesn't exist
            # Re-raise to fail customer creation and maintain data consistency
            log.error(
                "member.create_owner_member.integrity_error_no_member",
                customer_id=customer.id,
                organization_id=organization.id,
                error=str(e),
            )
            raise

    async def list_by_customer(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
    ) -> Sequence[Member]:
        repository = MemberRepository.from_session(session)
        return await repository.list_by_customer(session, customer_id)

    async def list_by_customers(
        self,
        session: AsyncReadSession,
        customer_ids: Sequence[UUID],
    ) -> Sequence[Member]:
        """
        Get all members for multiple customers (batch loading to avoid N+1 queries).
        """
        repository = MemberRepository.from_session(session)
        return await repository.list_by_customers(session, customer_ids)


member_service = MemberService()
