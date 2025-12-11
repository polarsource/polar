from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject, Organization, User
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models.customer import Customer
from polar.models.member import Member, MemberRole
from polar.models.organization import Organization as OrgModel
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import MemberRepository
from .sorting import MemberSortProperty

log = structlog.get_logger()


class MemberService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        customer_id: UUID | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[MemberSortProperty]] = [
            (MemberSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Member], int]:
        """List members with pagination and filtering."""
        repository = MemberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if customer_id is not None:
            statement = statement.where(Member.customer_id == customer_id)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == MemberSortProperty.created_at:
                order_by_clauses.append(clause_function(Member.created_at))
        statement = statement.order_by(*order_by_clauses)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def create_owner_member(
        self,
        session: AsyncSession,
        customer: Customer,
        organization: OrgModel,
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
            organization_id=organization.id,
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

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> Member | None:
        """Get a member by ID with auth subject validation."""
        repository = MemberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Member.id == id
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def delete(
        self,
        session: AsyncSession,
        member: Member,
    ) -> Member:
        """Soft delete a member."""
        repository = MemberRepository.from_session(session)
        deleted_member = await repository.soft_delete(member)
        log.info(
            "member.delete.success",
            member_id=member.id,
            customer_id=member.customer_id,
            organization_id=member.organization_id,
        )
        return deleted_member


member_service = MemberService()
