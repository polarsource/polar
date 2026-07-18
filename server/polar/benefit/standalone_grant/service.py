from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.scope import resolve_member
from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.exceptions import (
    PolarRequestValidationError,
    ResourceNotFound,
    ValidationError,
)
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Organization,
    StandaloneGrant,
    User,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import StandaloneGrantRepository
from .schemas import StandaloneGrantBenefitCreate

STANDALONE_GRANTABLE_BENEFIT_TYPES = {
    BenefitType.feature_flag,
    BenefitType.custom,
    BenefitType.license_keys,
}


class StandaloneGrantService:
    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        customer_id: UUID,
        grants: Sequence[StandaloneGrantBenefitCreate],
        expires_at: datetime | None = None,
        reason: str | None = None,
    ) -> StandaloneGrant:
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

        resolved: list[tuple[Benefit, Member | None]] = []
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

            if benefit.type not in STANDALONE_GRANTABLE_BENEFIT_TYPES:
                errors.append(
                    {
                        "loc": ("body", "grants", index, "benefit_id"),
                        "msg": "This benefit type cannot be granted as a standalone grant.",
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
                        "msg": "Duplicate benefit and member in the same standalone grant.",
                        "type": "value_error",
                        "input": str(grant.benefit_id),
                    }
                )
                continue
            seen.add(key)
            resolved.append((benefit, member))

        if errors:
            raise PolarRequestValidationError(errors)

        repository = StandaloneGrantRepository.from_session(session)
        standalone_grant = StandaloneGrant(
            customer=customer,
            expires_at=expires_at,
            reason=reason,
        )
        await repository.create(standalone_grant, flush=True)

        benefit_grants = [
            BenefitGrant(
                customer=customer,
                benefit=benefit,
                member=member,
                standalone_grant=standalone_grant,
                properties={},
            )
            for benefit, member in resolved
        ]
        session.add_all(benefit_grants)
        await session.flush()

        for benefit_grant in benefit_grants:
            enqueue_job(
                "benefit.grant",
                customer_id=customer.id,
                benefit_id=benefit_grant.benefit_id,
                member_id=benefit_grant.member_id,
                standalone_grant_id=standalone_grant.id,
            )

        await session.refresh(standalone_grant, {"grants"})
        return standalone_grant

    async def request_revoke(
        self,
        session: AsyncSession,
        standalone_grant: StandaloneGrant,
        grant: BenefitGrant,
    ) -> StandaloneGrant:
        grant_repository = BenefitGrantRepository.from_session(session)
        locked_grant = await grant_repository.get_by_id(
            grant.id,
            for_update=True,
            options=(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            ),
        )
        if locked_grant is None:
            raise ResourceNotFound("Benefit grant not found")
        grant = locked_grant

        if grant.is_revoked:
            return standalone_grant

        enqueue_job(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            standalone_grant_id=standalone_grant.id,
        )
        return standalone_grant

    async def request_revoke_expired(
        self,
        session: AsyncSession,
        *,
        limit: int,
    ) -> int:
        now = datetime.now(UTC)
        repository = StandaloneGrantRepository.from_session(session)
        standalone_grants = await repository.list_expired_for_update(now, limit=limit)
        grants_to_revoke: list[BenefitGrant] = []

        for standalone_grant in standalone_grants:
            for grant in standalone_grant.grants:
                if grant.is_revoked:
                    continue
                grants_to_revoke.append(grant)

        for grant in grants_to_revoke:
            enqueue_job(
                "benefit.revoke",
                customer_id=grant.customer_id,
                benefit_id=grant.benefit_id,
                member_id=grant.member_id,
                standalone_grant_id=grant.standalone_grant_id,
            )

        return len(standalone_grants)


standalone_grant = StandaloneGrantService()
