from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.customer.repository import CustomerRepository
from polar.exceptions import NotPermitted, ResourceNotFound
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

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> Member | None:
        """Get a member by ID if the auth subject has access to it."""
        repository = MemberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Member.id == id
        )
        return await repository.get_one_or_none(statement)

    async def delete(
        self,
        session: AsyncSession,
        member: Member,
    ) -> Member:
        """
        Soft delete a member.

        Args:
            session: Database session
            member: Member to delete

        Returns:
            Deleted Member
        """
        repository = MemberRepository.from_session(session)
        deleted_member = await repository.soft_delete(member)
        log.info(
            "member.delete.success",
            member_id=member.id,
            customer_id=member.customer_id,
            organization_id=member.organization_id,
        )
        return deleted_member

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

    async def get_or_create_seat_member(
        self,
        session: AsyncSession,
        customer: Customer,
        organization: OrgModel,
    ) -> Member | None:
        """
        Get or create a member for a seat assignment if feature flag is enabled.

        Returns:
            Created/existing Member if feature flag enabled, None if flag disabled
        """
        if not organization.feature_settings.get("member_model_enabled", False):
            return None

        repository = MemberRepository.from_session(session)

        existing_member = await repository.get_by_customer_and_email(
            session, customer, email=customer.email
        )
        if existing_member:
            return existing_member

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name=customer.name,
            role=MemberRole.member,
        )

        try:
            return await repository.create(member)
        except IntegrityError:
            existing_member = await repository.get_by_customer_and_email(
                session, customer, email=customer.email
            )
            if existing_member:
                return existing_member
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

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        customer_id: UUID,
        email: str,
        name: str | None = None,
        external_id: str | None = None,
        role: MemberRole = MemberRole.member,
    ) -> Member:
        """
        Create a new member for a customer.

        Args:
            session: Database session
            auth_subject: Authenticated user/organization
            customer_id: ID of the customer to add member to
            email: Email address of the member
            name: Optional name of the member
            external_id: Optional external ID of the member
            role: Role of the member (defaults to member)

        Returns:
            Created Member

        Raises:
            ResourceNotFound: If customer not found or not accessible
            NotPermitted: If feature flag disabled or no permission to add members
        """
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_readable_by_id(
            auth_subject, customer_id, options=(joinedload(Customer.organization),)
        )

        if customer is None:
            raise ResourceNotFound("Customer not found")

        if not customer.organization.feature_settings.get(
            "member_model_enabled", False
        ):
            raise NotPermitted("Member management is not enabled for this organization")

        repository = MemberRepository.from_session(session)

        existing_member = await repository.get_by_customer_and_email(
            session, customer, email=email
        )
        if existing_member:
            log.info(
                "member.create.already_exists",
                customer_id=customer_id,
                email=email,
                existing_member_id=existing_member.id,
            )
            return existing_member

        member = Member(
            customer_id=customer_id,
            organization_id=customer.organization_id,
            email=email,
            name=name,
            external_id=external_id,
            role=role,
        )

        try:
            created_member = await repository.create(member, flush=True)
            log.info(
                "member.create.success",
                customer_id=customer_id,
                member_id=created_member.id,
                organization_id=customer.organization_id,
                role=role,
            )
            return created_member
        except IntegrityError as e:
            log.warning(
                "member.create.constraint_violation",
                customer_id=customer_id,
                organization_id=customer.organization_id,
                error=str(e),
            )
            existing_member = await repository.get_by_customer_and_email(
                session, customer, email=email
            )
            if existing_member:
                log.info(
                    "member.create.found_existing_after_error",
                    customer_id=customer_id,
                    member_id=existing_member.id,
                )
                return existing_member
            raise


member_service = MemberService()
