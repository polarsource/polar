from collections.abc import Sequence

from polar.auth.models import AuthSubject
from polar.kit.utils import utc_now
from polar.models import Organization, VoidMeter
from polar.postgres import AsyncSession
from polar.void.customer.repository import CustomerBindingRepository
from polar.void.customer.service import customer as customer_service
from polar.void.meter.service import meter as meter_service
from polar.void.subscription.service import subscription as subscription_service
from polar.void.tinybird import TinybirdApi

from .schemas import Identity, IdentitySnapshot
from .service import identity as identity_service


def _latest_meters(
    meters: Sequence[VoidMeter], variant_id: str | None = None
) -> dict[str, VoidMeter]:
    latest: dict[str, VoidMeter] = {}
    for meter in meters:
        if meter.branch_id is not None or meter.variant_id != variant_id:
            continue
        current = latest.get(meter.slug)
        if current is None or meter.generation_id > current.generation_id:
            latest[meter.slug] = meter
    return latest


class IdentitySnapshotService:
    async def get(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        auth_subject: AuthSubject[Organization],
        external_id: str,
        variant_id: str | None = None,
    ) -> IdentitySnapshot:
        organization_id = auth_subject.subject.id
        at = utc_now()
        identity = await identity_service.get(session, organization_id, external_id)
        root = await identity_service.root_of(session, identity)
        binding = await CustomerBindingRepository.from_session(
            session
        ).get_active_by_identity_id(organization_id, root.id)
        customer = None
        if binding is not None:
            customer = await customer_service.get(
                session, auth_subject, root.external_id
            )
        meters = _latest_meters(
            await meter_service.list(session, organization_id), variant_id
        )
        balances = {
            slug: await meter_service.balance(
                session, tinybird, organization_id, meter.id, identity.external_id, at
            )
            for slug, meter in meters.items()
        }
        return IdentitySnapshot(
            at=at,
            identity=Identity.model_validate(identity),
            root=Identity.model_validate(root),
            customer=customer,
            meters=balances,
            entitlements=(
                await subscription_service.held(
                    session, organization_id, identity.external_id, at
                )
            ).slugs,
        )


snapshot = IdentitySnapshotService()
