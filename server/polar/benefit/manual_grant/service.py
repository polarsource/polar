from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.benefit.grant.scope import resolve_member
from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.exceptions import (
    PolarError,
    PolarRequestValidationError,
    ResourceNotFound,
    ValidationError,
)
from polar.kit.pagination import PaginationParams
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    ManualGrant,
    Organization,
    User,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncReadSession, AsyncSession
from polar.worker import enqueue_job

from .repository import ManualGrantRepository
from .schemas import ManualGrantBenefitCreate

MANUALLY_GRANTABLE_BENEFIT_TYPES = {
    BenefitType.feature_flag,
    BenefitType.custom,
    BenefitType.license_keys,
}


class ManualGrantError(PolarError): ...


class ManualGrantService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        organization_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        benefit_id: Sequence[UUID] | None = None,
    ) -> tuple[Sequence[ManualGrant], int]:
        repository = ManualGrantRepository.from_session(session)
        statement = await repository.list_readable(
            auth_subject,
            organization_id=organization_id,
            customer_id=customer_id,
            benefit_id=benefit_id,
        )
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> ManualGrant | None:
        repository = ManualGrantRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(
                ManualGrant.id == id,
                ManualGrant.deleted_at.is_(None),
            )
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        customer_id: UUID,
        grants: Sequence[ManualGrantBenefitCreate],
        expires_at: datetime | None = None,
    ) -> ManualGrant:
        org_ids = await get_accessible_org_ids(session, auth_subject)

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_readable_by_id(
            org_ids, customer_id, options=(joinedload(Customer.organization),)
        )
        if customer is None:
            raise ResourceNotFound("Customer not found")

        benefit_repository = BenefitRepository.from_session(session)
        benefit_statement = (
            benefit_repository.get_base_statement()
            .where(Benefit.id.in_({grant.benefit_id for grant in grants}))
            .options(*benefit_repository.get_eager_options())
        )
        benefits = {
            benefit.id: benefit
            for benefit in await benefit_repository.get_all(benefit_statement)
        }

        resolved: list[tuple[UUID, UUID | None]] = []
        seen: set[tuple[UUID, UUID | None]] = set()
        errors: list[ValidationError] = []
        for index, grant in enumerate(grants):
            benefit = benefits.get(grant.benefit_id)
            if benefit is None or benefit.organization_id not in org_ids:
                errors.append(
                    {
                        "loc": ("body", "grants", index, "benefit_id"),
                        "msg": "Benefit not found.",
                        "type": "value_error",
                        "input": str(grant.benefit_id),
                    }
                )
                continue

            if benefit.organization_id != customer.organization_id:
                errors.append(
                    {
                        "loc": ("body", "grants", index, "benefit_id"),
                        "msg": (
                            "The customer and the benefit must belong to the same "
                            "organization."
                        ),
                        "type": "value_error",
                        "input": str(grant.benefit_id),
                    }
                )
                continue

            if benefit.type not in MANUALLY_GRANTABLE_BENEFIT_TYPES:
                errors.append(
                    {
                        "loc": ("body", "grants", index, "benefit_id"),
                        "msg": "This benefit type cannot be granted manually.",
                        "type": "value_error",
                        "input": str(grant.benefit_id),
                        "ctx": {"benefit_type": str(benefit.type)},
                    }
                )
                continue

            member = await resolve_member(
                session,
                customer_id=customer.id,
                organization=customer.organization,
                member_id=grant.member_id,
                is_seat_based=False,
            )
            member_id = member.id if member is not None else None

            key = (grant.benefit_id, member_id)
            if key in seen:
                errors.append(
                    {
                        "loc": ("body", "grants", index, "benefit_id"),
                        "msg": "Duplicate benefit and member in the same manual grant.",
                        "type": "value_error",
                        "input": str(grant.benefit_id),
                    }
                )
                continue
            seen.add(key)
            resolved.append(key)

        if errors:
            raise PolarRequestValidationError(errors)

        repository = ManualGrantRepository.from_session(session)
        manual_grant = await repository.create(
            ManualGrant(customer=customer, expires_at=expires_at),
            flush=True,
        )

        for benefit_id, member_id in resolved:
            enqueue_job(
                "benefit.grant",
                customer_id=customer.id,
                benefit_id=benefit_id,
                member_id=member_id,
                manual_grant_id=manual_grant.id,
            )

        await session.refresh(manual_grant, {"grants"})
        return manual_grant

    async def revoke_grant(
        self,
        manual_grant: ManualGrant,
        grant: BenefitGrant,
    ) -> ManualGrant:
        enqueue_job(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            manual_grant_id=manual_grant.id,
        )
        return manual_grant


manual_grant = ManualGrantService()
