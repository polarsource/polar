from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

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
    ManualGrant,
    Organization,
    User,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import ManualGrantRepository

# Only benefit types whose grant/revoke side effects are per-grant-safe: they either
# have no external side effects (feature_flag, custom) or side effects owned by the
# individual grant (license_keys). Types with customer-keyed external side effects
# (Discord roles, GitHub invites, downloadables) would collide when a manual grant
# coexists with a subscription/order grant of the same benefit.
MANUALLY_GRANTABLE_BENEFIT_TYPES = {
    BenefitType.feature_flag,
    BenefitType.custom,
    BenefitType.license_keys,
}


class ManualGrantService:
    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        customer_id: UUID,
        benefit_ids: Sequence[UUID],
        expires_at: datetime | None = None,
        reason: str | None = None,
    ) -> ManualGrant:
        org_ids = await get_accessible_org_ids(session, auth_subject)

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_readable_by_id(
            org_ids, customer_id, options=(joinedload(Customer.organization),)
        )
        if customer is None:
            raise ResourceNotFound("Customer not found")

        # Manual grants are customer-level: like a non-seat purchase, the grant
        # targets the customer and the owner member is resolved automatically.
        member = await resolve_member(
            session,
            customer_id=customer.id,
            organization=customer.organization,
            member_id=None,
            is_seat_based=False,
        )
        member_id = member.id if member is not None else None

        benefit_repository = BenefitRepository.from_session(session)
        benefit_statement = (
            benefit_repository.get_base_statement()
            .where(Benefit.id.in_(set(benefit_ids)))
            .options(*benefit_repository.get_eager_options())
        )
        benefits = {
            benefit.id: benefit
            for benefit in await benefit_repository.get_all(benefit_statement)
        }

        grant_repository = BenefitGrantRepository.from_session(session)
        already_granted_ids = (
            await grant_repository.list_active_manual_grant_benefit_ids(
                customer.id, benefit_ids, member_id=member_id
            )
        )

        resolved: list[Benefit] = []
        seen: set[UUID] = set()
        errors: list[ValidationError] = []
        for index, benefit_id in enumerate(benefit_ids):
            benefit = benefits.get(benefit_id)
            if benefit is None or benefit.organization_id not in org_ids:
                errors.append(
                    {
                        "loc": ("body", "benefit_ids", index),
                        "msg": "Benefit not found.",
                        "type": "value_error",
                        "input": str(benefit_id),
                    }
                )
                continue

            if benefit.organization_id != customer.organization_id:
                errors.append(
                    {
                        "loc": ("body", "benefit_ids", index),
                        "msg": (
                            "The customer and the benefit must belong to the same "
                            "organization."
                        ),
                        "type": "value_error",
                        "input": str(benefit_id),
                    }
                )
                continue

            if benefit.type not in MANUALLY_GRANTABLE_BENEFIT_TYPES:
                errors.append(
                    {
                        "loc": ("body", "benefit_ids", index),
                        "msg": "This benefit type cannot be granted manually.",
                        "type": "value_error",
                        "input": str(benefit_id),
                        "ctx": {"benefit_type": str(benefit.type)},
                    }
                )
                continue

            if benefit_id in seen:
                errors.append(
                    {
                        "loc": ("body", "benefit_ids", index),
                        "msg": "Duplicate benefit in the same request.",
                        "type": "value_error",
                        "input": str(benefit_id),
                    }
                )
                continue

            if benefit_id in already_granted_ids:
                errors.append(
                    {
                        "loc": ("body", "benefit_ids", index),
                        "msg": (
                            "This benefit is already manually granted to this customer."
                        ),
                        "type": "value_error",
                        "input": str(benefit_id),
                    }
                )
                continue

            seen.add(benefit_id)
            resolved.append(benefit)

        if errors:
            raise PolarRequestValidationError(errors)

        repository = ManualGrantRepository.from_session(session)
        manual_grant = ManualGrant(
            customer=customer,
            expires_at=expires_at,
            reason=reason,
        )
        await repository.create(manual_grant, flush=True)

        benefit_grants = [
            BenefitGrant(
                customer=customer,
                benefit=benefit,
                member=member,
                manual_grant=manual_grant,
                properties={},
            )
            for benefit in resolved
        ]
        session.add_all(benefit_grants)
        await session.flush()

        for benefit_grant in benefit_grants:
            enqueue_job(
                "benefit.grant",
                customer_id=customer.id,
                benefit_id=benefit_grant.benefit_id,
                member_id=benefit_grant.member_id,
                manual_grant_id=manual_grant.id,
            )

        await session.refresh(manual_grant, {"grants"})
        return manual_grant

    async def request_revoke(
        self,
        session: AsyncSession,
        grant: BenefitGrant,
    ) -> BenefitGrant:
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

        if locked_grant.is_revoked:
            return grant

        enqueue_job(
            "benefit.revoke",
            customer_id=locked_grant.customer_id,
            benefit_id=locked_grant.benefit_id,
            member_id=locked_grant.member_id,
            manual_grant_id=locked_grant.manual_grant_id,
        )
        return grant

    async def revoke_expired(
        self,
        session: AsyncSession,
        manual_grant_id: UUID,
    ) -> int:
        """Enqueue revocation of an expired manual grant's remaining children.

        Dispatched exactly once per manual grant by ``ManualGrantExpiryJobStore``
        at ``expires_at``; retries beyond this point are the revoke jobs' own.
        """
        repository = ManualGrantRepository.from_session(session)
        manual_grant = await repository.get_by_id(
            manual_grant_id, options=(selectinload(ManualGrant.grants),)
        )
        if manual_grant is None or manual_grant.expires_at is None:
            return 0

        count = 0
        for grant in manual_grant.grants:
            if grant.is_revoked:
                continue
            enqueue_job(
                "benefit.revoke",
                customer_id=grant.customer_id,
                benefit_id=grant.benefit_id,
                member_id=grant.member_id,
                manual_grant_id=manual_grant.id,
            )
            count += 1
        return count


manual_grant = ManualGrantService()
