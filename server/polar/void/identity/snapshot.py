from polar.authz.dependencies import AuthzContext
from polar.kit.utils import utc_now
from polar.models import Organization, User
from polar.postgres import AsyncSession
from polar.void.customer.repository import CustomerRepository
from polar.void.customer.service import customer as customer_service
from polar.void.meter.service import meter as meter_service
from polar.void.meter.versions import meters_in_version
from polar.void.sense.service import sense as sense_service
from polar.void.subscription.service import subscription as subscription_service
from polar.void.tinybird import TinybirdApi

from .schemas import Identity, IdentitySnapshot
from .service import identity as identity_service


class IdentitySnapshotService:
    async def get(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        auth: AuthzContext[User | Organization],
        external_id: str,
        version_id: str | None,
    ) -> IdentitySnapshot:
        organization_id = auth.organization.id
        at = utc_now()
        identity = await identity_service.get(session, organization_id, external_id)
        root = await identity_service.root_of(session, identity)
        native = await CustomerRepository.from_session(
            session
        ).get_active_by_identity_id(organization_id, root.id)
        customer = None
        if native is not None:
            customer = await customer_service.get(session, auth, root.external_id)
        meters = meters_in_version(
            await meter_service.list(session, organization_id), version_id
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
            senses=(
                await sense_service.observations_for(
                    session, organization_id, version_id, [identity.external_id]
                )
                if version_id is not None
                else []
            ),
        )


snapshot = IdentitySnapshotService()
