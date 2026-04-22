from collections.abc import Sequence
from datetime import datetime
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
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

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
        role: MemberRole | None = None,
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

        if role is not None:
            statement = statement.where(Member.role == role)

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

    async def get_by_external_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        external_id: str,
        *,
        customer_id: UUID | None = None,
        external_customer_id: str | None = None,
    ) -> Member | None:
        """Get a member by external ID if the auth subject has access to it."""
        repository = MemberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Member.external_id == external_id
        )

        if external_customer_id is not None:
            statement = statement.join(Customer).where(
                Customer.external_id == external_customer_id
            )
        if customer_id is not None:
            statement = statement.where(Member.customer_id == customer_id)

        return await repository.get_one_or_none(statement)

    async def delete(
        self,
        session: AsyncSession,
        member: Member,
    ) -> Member:
        """
        Soft delete a member.

        Any active seats assigned to this member will be automatically revoked
        before deletion.

        Args:
            session: Database session
            member: Member to delete

        Returns:
            Deleted Member

        Raises:
            PolarRequestValidationError: If trying to delete the only owner
        """
        repository = MemberRepository.from_session(session)

        # Prevent deleting the only owner
        if member.role == MemberRole.owner:
            members = await repository.list_by_customer(session, member.customer_id)
            owner_count = sum(1 for m in members if m.role == MemberRole.owner)
            if owner_count <= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body",),
                            "msg": "Cannot delete the only owner. Transfer ownership first.",
                            "input": str(member.id),
                        }
                    ]
                )

        enqueue_job("customer_seat.revoke_seats_for_member", member_id=member.id)

        deleted_member = await repository.soft_delete(member)
        log.info(
            "member.delete.success",
            member_id=member.id,
            customer_id=member.customer_id,
            organization_id=member.organization_id,
        )

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(member.organization_id)
        if organization:
            await webhook_service.send(
                session,
                organization,
                WebhookEventType.member_deleted,
                deleted_member,
            )

        return deleted_member

    async def delete_by_customer(
        self,
        session: AsyncSession,
        customer_id: UUID,
    ) -> Sequence[Member]:
        """
        Soft-delete all members for a customer.

        Unlike delete(), this skips the owner guard since the entire
        customer is being removed.
        """
        from polar.benefit.grant.service import (
            benefit_grant as benefit_grant_service,
        )

        repository = MemberRepository.from_session(session)
        members = await repository.list_by_customer(session, customer_id)

        if not members:
            return []

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            members[0].organization_id
        )

        deleted: list[Member] = []
        for member in members:
            enqueue_job("customer_seat.revoke_seats_for_member", member_id=member.id)
            await benefit_grant_service.enqueue_member_grant_deletions(
                session, member.id
            )
            deleted_member = await repository.soft_delete(member)
            log.info(
                "member.delete.success",
                member_id=member.id,
                customer_id=member.customer_id,
                organization_id=member.organization_id,
            )

            if organization:
                await webhook_service.send(
                    session,
                    organization,
                    WebhookEventType.member_deleted,
                    deleted_member,
                )
            deleted.append(deleted_member)

        return deleted

    async def sync_owner_email(
        self,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        """Mirror customer.email to the owner member's email for individual
        customers. Any drift otherwise causes the portal sign-in flow to
        auto-create a duplicate owner (the owner-by-email lookup misses the
        drifted row). Team customers legitimately have members with distinct
        emails, so they are skipped."""
        if customer.type != CustomerType.individual or customer.email is None:
            return

        repository = MemberRepository.from_session(session)
        owner = await repository.get_owner_by_customer_id(session, customer.id)
        if owner is None or owner.email.lower() == customer.email.lower():
            return

        old_email = owner.email
        await repository.update(owner, update_dict={"email": customer.email})
        log.info(
            "member.sync_owner_email",
            customer_id=customer.id,
            member_id=owner.id,
            old_email=old_email,
            new_email=customer.email,
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
        send_webhook: bool = True,
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
        member_model = organization.feature_settings.get("member_model_enabled", False)
        seat_based = organization.feature_settings.get(
            "seat_based_pricing_enabled", False
        )
        if not member_model and not seat_based:
            log.debug(
                "member.create_owner_member.skipped",
                reason="feature_flag_disabled",
                customer_id=customer.id,
                organization_id=organization.id,
            )
            return None

        repository = MemberRepository.from_session(session)

        raw_email = owner_email or customer.email
        if raw_email is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "email"),
                        "msg": "An email is required to create an owner member.",
                        "input": None,
                    }
                ]
            )
        email = raw_email.strip()
        name = owner_name or customer.name
        external_id = owner_external_id or customer.external_id

        # A customer has at most one owner. Short-circuit on any existing owner
        # regardless of email — if we only dedupe by (customer_id, email), a drifted
        # owner.email (e.g., typo in original email that was later corrected on the
        # customer) produces a duplicate owner on the next sign-in.
        existing_owner = await repository.get_owner_by_customer_id(session, customer.id)
        if existing_owner is not None:
            log.debug(
                "member.create_owner_member.skipped",
                reason="owner_already_exists",
                customer_id=customer.id,
                member_id=existing_owner.id,
            )
            return existing_owner

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=email,
            name=name,
            external_id=external_id,
            role=MemberRole.owner,
            created_at=customer.created_at,
        )

        try:
            created_member = await repository.create(member, flush=True)
            log.info(
                "member.create_owner_member.success",
                customer_id=customer.id,
                member_id=created_member.id,
                organization_id=organization.id,
            )
            if send_webhook:
                await webhook_service.send(
                    session,
                    organization,
                    WebhookEventType.member_created,
                    created_member,
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
            existing_owner = await repository.get_owner_by_customer_id(
                session, customer.id
            )
            if existing_owner is not None:
                log.info(
                    "member.create_owner_member.found_existing",
                    customer_id=customer.id,
                    member_id=existing_owner.id,
                )
                return existing_owner

            # Weird state: IntegrityError but no owner exists
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
        member_model = organization.feature_settings.get("member_model_enabled", False)
        seat_based = organization.feature_settings.get(
            "seat_based_pricing_enabled", False
        )
        if not member_model and not seat_based:
            return None

        if customer.email is None:
            return None

        return await self.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name=customer.name,
            role=MemberRole.member,
        )

    async def get_or_create_by_email(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
        organization_id: UUID,
        email: str,
        name: str | None = None,
        external_id: str | None = None,
        role: MemberRole = MemberRole.member,
    ) -> Member:
        """
        Get or create a member by email under a customer.

        Consolidated get-or-create pattern that handles:
        - Returning existing active members
        - Race condition retries on IntegrityError
        - Email normalization (strip whitespace)
        """
        email = email.strip()

        repository = MemberRepository.from_session(session)

        existing = await repository.get_by_customer_id_and_email(customer_id, email)
        if existing:
            return existing
        member = Member(
            customer_id=customer_id,
            organization_id=organization_id,
            email=email,
            name=name,
            external_id=external_id,
            role=role,
        )

        try:
            created = await repository.create(member, flush=True)
            log.info(
                "member.get_or_create_by_email.created",
                member_id=created.id,
                customer_id=customer_id,
                organization_id=organization_id,
                email=email,
            )
            return created
        except IntegrityError:
            # 4. Race condition: another transaction created the member concurrently
            log.info(
                "member.get_or_create_by_email.integrity_error_retry",
                customer_id=customer_id,
                email=email,
            )
            existing = await repository.get_by_customer_id_and_email(customer_id, email)
            if existing:
                return existing
            raise

    async def list_by_customer(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
    ) -> Sequence[Member]:
        repository = MemberRepository.from_session(session)
        return await repository.list_by_customer(session, customer_id)

    async def get_by_customer_and_id(
        self,
        session: AsyncReadSession,
        customer_id: UUID,
        member_id: UUID,
    ) -> Member | None:
        """Get a member by customer ID and member ID."""
        repository = MemberRepository.from_session(session)
        return await repository.get_by_id_and_customer_id(member_id, customer_id)

    async def add_to_customer(
        self,
        session: AsyncSession,
        customer: Customer,
        *,
        email: str,
        name: str | None = None,
        role: MemberRole = MemberRole.member,
    ) -> Member:
        """
        Add a member to a customer.

        Args:
            session: Database session
            customer: Customer to add member to
            email: Email address of the member
            name: Optional name of the member
            role: Role of the member (defaults to member)

        Returns:
            Created or existing Member
        """
        return await self.get_or_create_by_email(
            session,
            customer_id=customer.id,
            organization_id=customer.organization_id,
            email=email,
            name=name,
            role=role,
        )

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
        created_at: datetime | None = None,
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

        member_model = customer.organization.feature_settings.get(
            "member_model_enabled", False
        )
        seat_based = customer.organization.feature_settings.get(
            "seat_based_pricing_enabled", False
        )
        if not member_model and not seat_based:
            raise NotPermitted("Member management is not enabled for this organization")

        email = email.strip()

        repository = MemberRepository.from_session(session)

        # Individual customers can only have 1 member (the owner)
        # NULL type is treated as 'individual' (legacy customers)
        customer_type = customer.type or CustomerType.individual
        if customer_type == CustomerType.individual:
            existing_members = await repository.list_by_customer(session, customer_id)
            active_members = [m for m in existing_members if not m.is_deleted]
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
        if created_at is not None:
            member.created_at = created_at

        try:
            created_member = await repository.create(member, flush=True)
            log.info(
                "member.create.success",
                customer_id=customer_id,
                member_id=created_member.id,
                organization_id=customer.organization_id,
                role=role,
            )
            await webhook_service.send(
                session,
                customer.organization,
                WebhookEventType.member_created,
                created_member,
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
        caller_member: Member | None = None,
        allow_ownership_transfer: bool = False,
    ) -> Member:
        """
        Update a member.

        Args:
            session: Database session
            member: Member to update
            name: Optional new name
            role: Optional new role
            caller_member: The member making the request (for customer portal ownership transfer)
            allow_ownership_transfer: If True, allows ownership transfer without caller_member
                                      (for admin API). The existing owner will be demoted.

        For ownership transfer:
            - Customer portal: Only the current owner can transfer ownership (via caller_member)
            - Admin API: Set allow_ownership_transfer=True to transfer ownership
            - When promoting to owner, the existing owner is automatically demoted to billing_manager
        """
        repository = MemberRepository.from_session(session)

        if role is not None and member.role != role:
            members = await repository.list_by_customer(session, member.customer_id)
            owner_count = sum(1 for m in members if m.role == MemberRole.owner)

            is_current_owner = member.role == MemberRole.owner
            is_becoming_owner = role == MemberRole.owner
            is_losing_owner_role = is_current_owner and not is_becoming_owner
            is_gaining_owner_role = is_becoming_owner and not is_current_owner

            # Handle ownership transfer
            if is_gaining_owner_role and owner_count >= 1:
                # Check if caller has permission to transfer ownership
                caller_is_owner = (
                    caller_member is not None and caller_member.role == MemberRole.owner
                )
                if not caller_is_owner and not allow_ownership_transfer:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "role"),
                                "msg": "Only the owner can transfer ownership.",
                                "input": role,
                            }
                        ]
                    )

                # Find and demote the current owner
                if caller_is_owner and caller_member is not None:
                    # Customer portal: demote the caller (who is the owner)
                    await repository.update(
                        caller_member, update_dict={"role": MemberRole.billing_manager}
                    )
                    log.info(
                        "member.update.ownership_transfer",
                        old_owner_id=caller_member.id,
                        new_owner_id=member.id,
                        customer_id=member.customer_id,
                    )
                else:
                    # Admin API: find and demote the existing owner
                    current_owner = next(
                        (m for m in members if m.role == MemberRole.owner), None
                    )
                    if current_owner:
                        await repository.update(
                            current_owner,
                            update_dict={"role": MemberRole.billing_manager},
                        )
                        log.info(
                            "member.update.ownership_transfer",
                            old_owner_id=current_owner.id,
                            new_owner_id=member.id,
                            customer_id=member.customer_id,
                            admin_transfer=True,
                        )

            # Prevent removing the last owner
            if is_losing_owner_role and owner_count <= 1:
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

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(member.organization_id)
        if organization:
            await webhook_service.send(
                session,
                organization,
                WebhookEventType.member_updated,
                updated_member,
            )

        return updated_member


member_service = MemberService()
