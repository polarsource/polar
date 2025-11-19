import structlog
from sqlalchemy.exc import IntegrityError

from polar.models.customer import Customer
from polar.models.member import Member, MemberRole
from polar.models.organization import Organization
from polar.postgres import AsyncSession

from .repository import MemberRepository

log = structlog.get_logger()


class MemberService:
    async def create_owner_member(
        self,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> Member | None:
        """
        Create an owner member for a customer if feature flag is enabled.

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

        existing_member = await repository.get_by_customer_and_email(session, customer)
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
            email=customer.email,
            name=customer.name,
            external_id=customer.external_id,
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
                session, customer
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


member_service = MemberService()
