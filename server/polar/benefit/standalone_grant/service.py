from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import get_accessible_org_ids
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.scope import resolve_member
from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.event.service import event as event_service
from polar.event.system import (
    BenefitGrantRequestMetadata,
    SystemEvent,
    build_system_event,
)
from polar.exceptions import (
    PolarRequestValidationError,
    ResourceNotFound,
    ValidationError,
)
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    StandaloneGrant,
    Member,
    Organization,
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
            created_by_user=auth_subject.subject if is_user(auth_subject) else None,
            created_by_organization=(
                auth_subject.subject if is_organization(auth_subject) else None
            ),
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
            await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.benefit_grant_requested,
                    customer=customer,
                    organization=customer.organization,
                    metadata=self._build_request_metadata(
                        auth_subject, standalone_grant, benefit_grant
                    ),
                ),
            )

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

    async def revoke_grant(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        standalone_grant: StandaloneGrant,
        grant: BenefitGrant,
    ) -> StandaloneGrant:
        grant_repository = BenefitGrantRepository.from_session(session)
        locked_grant = await grant_repository.get_by_id(grant.id, for_update=True)
        if locked_grant is None:
            raise ResourceNotFound("Benefit grant not found")
        await session.refresh(
            locked_grant,
            {"granted_at", "revoked_at", "revoke_requested_at"},
        )
        grant = locked_grant

        if grant.is_revoked:
            return standalone_grant
        if grant.revoke_requested_at is not None and grant.error is None:
            return standalone_grant

        grant.set_revoke_requested()
        session.add(grant)
        await session.flush()
        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.benefit_revoke_requested,
                customer=grant.customer,
                organization=grant.benefit.organization,
                metadata=self._build_request_metadata(
                    auth_subject, standalone_grant, grant
                ),
            ),
        )
        enqueue_job(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            standalone_grant_id=standalone_grant.id,
        )
        return standalone_grant

    async def revoke_expired(
        self,
        session: AsyncSession,
        *,
        limit: int,
    ) -> int:
        now = datetime.now(UTC)
        repository = StandaloneGrantRepository.from_session(session)
        standalone_grants = await repository.list_expired_for_update(now, limit=limit)
        grants_to_revoke: list[tuple[StandaloneGrant, BenefitGrant]] = []

        for standalone_grant in standalone_grants:
            standalone_grant.revocation_requested_at = now
            session.add(standalone_grant)
            for grant in standalone_grant.grants:
                if grant.is_revoked or grant.revoke_requested_at is not None:
                    continue
                grant.set_revoke_requested()
                session.add(grant)
                grants_to_revoke.append((standalone_grant, grant))

        await session.flush()

        for standalone_grant, grant in grants_to_revoke:
            await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.benefit_revoke_requested,
                    customer=grant.customer,
                    organization=grant.benefit.organization,
                    metadata=self._build_expiration_request_metadata(
                        standalone_grant, grant
                    ),
                ),
            )
            enqueue_job(
                "benefit.revoke",
                customer_id=grant.customer_id,
                benefit_id=grant.benefit_id,
                member_id=grant.member_id,
                standalone_grant_id=standalone_grant.id,
            )

        return len(standalone_grants)

    def _build_request_metadata(
        self,
        auth_subject: AuthSubject[User | Organization],
        standalone_grant: StandaloneGrant,
        grant: BenefitGrant,
    ) -> BenefitGrantRequestMetadata:
        requested_by_type: Literal["user", "organization"] = (
            "user" if is_user(auth_subject) else "organization"
        )
        metadata: BenefitGrantRequestMetadata = {
            "benefit_id": str(grant.benefit_id),
            "benefit_grant_id": str(grant.id),
            "benefit_type": grant.benefit.type,
            "standalone_grant_id": str(standalone_grant.id),
            "requested_by_type": requested_by_type,
            "requested_by_id": str(auth_subject.subject.id),
        }
        if grant.member_id is not None:
            metadata["member_id"] = str(grant.member_id)
        if standalone_grant.reason is not None:
            metadata["reason"] = standalone_grant.reason
        if standalone_grant.expires_at is not None:
            metadata["expires_at"] = standalone_grant.expires_at.isoformat()
        return metadata

    def _build_expiration_request_metadata(
        self,
        standalone_grant: StandaloneGrant,
        grant: BenefitGrant,
    ) -> BenefitGrantRequestMetadata:
        metadata: BenefitGrantRequestMetadata = {
            "benefit_id": str(grant.benefit_id),
            "benefit_grant_id": str(grant.id),
            "benefit_type": grant.benefit.type,
            "standalone_grant_id": str(standalone_grant.id),
            "requested_by_type": "system",
            "requested_by_id": "standalone_grant.expiration",
        }
        if grant.member_id is not None:
            metadata["member_id"] = str(grant.member_id)
        if standalone_grant.reason is not None:
            metadata["reason"] = standalone_grant.reason
        if standalone_grant.expires_at is not None:
            metadata["expires_at"] = standalone_grant.expires_at.isoformat()
        return metadata


standalone_grant = StandaloneGrantService()
