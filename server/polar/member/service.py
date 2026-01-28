from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.customer.repository import CustomerRepository
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models.customer import Customer, CustomerType
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
        external_customer_id: str | None = None,
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

        if external_customer_id is not None:
            statement = statement.join(Customer).where(
                Customer.external_id == external_customer_id
            )

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

        # Individual customers can only have 1 member (the owner)
        # NULL type is treated as 'individual' (legacy customers)
        customer_type = customer.type or CustomerType.individual
        if customer_type == CustomerType.individual:
            existing_members = await repository.list_by_customer(session, customer_id)
            active_members = [m for m in existing_members if m.deleted_at is None]
            if len(active_members) >= 1:
                raise NotPermitted(
                    "Individual customers can only have one member (the owner). "
                    "Upgrade to a team customer to add more members."
                )

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

    async def update(
        self,
        session: AsyncSession,
        member: Member,
        *,
        name: str | None = None,
        role: MemberRole | None = None,
    ) -> Member:
        """Update a member."""
        repository = MemberRepository.from_session(session)

        if role is not None and member.role != role:
            members = await repository.list_by_customer(session, member.customer_id)
            owner_count = sum(1 for m in members if m.role == MemberRole.owner)

            is_current_owner = member.role == MemberRole.owner
            is_becoming_owner = role == MemberRole.owner
            is_losing_owner_role = is_current_owner and not is_becoming_owner
            is_gaining_owner_role = is_becoming_owner and not is_current_owner

            # Prevent removing the last owner or adding a second owner
            if (is_losing_owner_role and owner_count <= 1) or (
                is_gaining_owner_role and owner_count >= 1
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "role"),
                            "msg": "Cannot change role. Customer must have exactly one owner.",
                            "input": role,
                        }
                    ]
                )

        update_dict = {}
        if name is not None:
            update_dict["name"] = name
        if role is not None:
            update_dict["role"] = role

        if not update_dict:
            return member

        updated_member = await repository.update(member, update_dict=update_dict)
        log.info(
            "member.update.success",
            member_id=member.id,
            customer_id=member.customer_id,
            organization_id=member.organization_id,
            updated_fields=list(update_dict.keys()),
        )
        return updated_member

    # Customer Portal Methods

    async def customer_portal_add_member(
        self,
        session: AsyncSession,
        customer: Customer,
        actor_member: Member,
        *,
        email: str,
        name: str | None = None,
        role: MemberRole = MemberRole.member,
    ) -> Member:
        """
        Add a member through the customer portal.

        Args:
            session: Database session
            customer: Customer to add member to
            actor_member: Member performing the action
            email: Email address of the new member
            name: Optional name of the new member
            role: Role of the new member (defaults to member)

        Returns:
            Created or existing Member

        Raises:
            PolarRequestValidationError: If trying to add an owner
        """
        # Prevent adding a new owner - there must be exactly one
        if role == MemberRole.owner:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "role"),
                        "msg": "Cannot add a member as owner. There must be exactly one owner.",
                        "input": role,
                    }
                ]
            )

        repository = MemberRepository.from_session(session)

        # Check if member already exists
        existing_member = await repository.get_by_customer_id_and_email(
            customer.id, email
        )
        if existing_member:
            log.debug(
                "customer_portal.members.add.already_exists",
                customer_id=customer.id,
                email=email,
                existing_member_id=existing_member.id,
                actor_member_id=actor_member.id,
            )
            return existing_member

        # Create the new member
        member = Member(
            customer_id=customer.id,
            organization_id=customer.organization_id,
            email=email,
            name=name,
            role=role,
        )

        created_member = await repository.create(member, flush=True)

        log.info(
            "customer_portal.members.add",
            customer_id=customer.id,
            member_id=created_member.id,
            email=email,
            role=role,
            actor_member_id=actor_member.id,
        )

        return created_member

    async def customer_portal_update_member(
        self,
        session: AsyncSession,
        customer: Customer,
        actor_member: Member,
        member_id: UUID,
        *,
        role: MemberRole | None = None,
    ) -> Member:
        """
        Update a member through the customer portal.

        Args:
            session: Database session
            customer: Customer the member belongs to
            actor_member: Member performing the action
            member_id: ID of the member to update
            role: New role for the member

        Returns:
            Updated Member

        Raises:
            ResourceNotFound: If member not found
            PolarRequestValidationError: If trying to modify own role or invalid role change
        """
        repository = MemberRepository.from_session(session)

        # Fetch the member to update
        member = await repository.get_by_id_and_customer_id(member_id, customer.id)
        if member is None:
            raise ResourceNotFound("Member not found")

        # If no role provided, return member unchanged
        if role is None:
            return member

        # Prevent self-modification
        if member.id == actor_member.id:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("path", "id"),
                        "msg": "You cannot modify your own role.",
                        "input": str(member_id),
                    }
                ]
            )

        # Check if role change is valid
        if member.role != role:
            members = await repository.list_by_customer(session, customer.id)
            owner_count = sum(1 for m in members if m.role == MemberRole.owner)

            # Demoting the only owner - need to check owner count
            if member.role == MemberRole.owner and owner_count <= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "role"),
                            "msg": "Cannot demote the only owner. The team must have at least one owner.",
                            "input": role,
                        }
                    ]
                )

            # Promoting to owner when there's already an owner
            if role == MemberRole.owner and owner_count >= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "role"),
                            "msg": "Cannot have multiple owners. Demote the current owner first.",
                            "input": role,
                        }
                    ]
                )

        # Update the member
        old_role = member.role
        updated_member = await repository.update(member, update_dict={"role": role})

        log.info(
            "customer_portal.members.update",
            customer_id=customer.id,
            member_id=member.id,
            actor_member_id=actor_member.id,
            old_role=old_role,
            new_role=role,
        )

        return updated_member

    async def customer_portal_remove_member(
        self,
        session: AsyncSession,
        customer: Customer,
        actor_member: Member,
        member_id: UUID,
    ) -> None:
        """
        Remove a member through the customer portal.

        Args:
            session: Database session
            customer: Customer the member belongs to
            actor_member: Member performing the action
            member_id: ID of the member to remove

        Raises:
            ResourceNotFound: If member not found
            PolarRequestValidationError: If trying to remove self or the only owner
        """
        repository = MemberRepository.from_session(session)

        # Fetch the member to remove
        member = await repository.get_by_id_and_customer_id(member_id, customer.id)
        if member is None:
            raise ResourceNotFound("Member not found")

        # Prevent self-removal
        if member.id == actor_member.id:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("path", "id"),
                        "msg": "You cannot remove yourself from the team.",
                        "input": str(member_id),
                    }
                ]
            )

        # Prevent removing the only owner
        if member.role == MemberRole.owner:
            members = await repository.list_by_customer(session, customer.id)
            owner_count = sum(1 for m in members if m.role == MemberRole.owner)
            if owner_count <= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("path", "id"),
                            "msg": "Cannot remove the only owner. Transfer ownership first.",
                            "input": str(member_id),
                        }
                    ]
                )

        # Soft delete the member
        await repository.soft_delete(member)

        log.info(
            "customer_portal.members.remove",
            customer_id=customer.id,
            member_id=member.id,
            member_role=member.role,
            actor_member_id=actor_member.id,
        )


member_service = MemberService()
