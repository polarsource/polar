import uuid
from collections.abc import Sequence

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.tinybird import TinybirdClient

from .schemas import (
    ProductSubscription,
    SubscriptionCancel,
    SubscriptionCreate,
    SubscriptionCycle,
    SubscriptionRebuild,
)
from .service import SubscriptionConflict, SubscriptionInvalid, to_schema
from .service import subscription as subscription_service

router = APIRouter(
    prefix="/subscriptions",
    tags=["subscriptions"],
    include_in_schema=False,
    responses={
        400: {"model": SubscriptionInvalid.schema()},
        404: {"model": ResourceNotFound.schema()},
        409: {"model": SubscriptionConflict.schema()},
    },
)


@router.get(
    "", operation_id="subscriptions:list", response_model=list[ProductSubscription]
)
async def list_subscriptions(
    auth_subject: VoidRead,
    external_identity_id: str | None = None,
    active: bool = False,
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[ProductSubscription]:
    """Subscriptions of the organization, or of one identity. `active` keeps
    only the ones granting access right now."""
    now = utc_now()
    subscriptions = await subscription_service.list(
        session,
        auth_subject.subject.id,
        external_identity_id,
        active_at=now if active else None,
    )
    return [to_schema(s, now) for s in subscriptions]


@router.post(
    "",
    operation_id="subscriptions:create",
    response_model=ProductSubscription,
    status_code=201,
)
async def create(
    body: SubscriptionCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ProductSubscription:
    """Subscribe an identity to a product generation, or record a one-time
    purchase. Writes the row and the events derived from it together."""
    subscription = await subscription_service.create(
        session, auth_subject.subject.id, body
    )
    return to_schema(subscription, utc_now())


@router.post(
    "/rebuild", operation_id="subscriptions:rebuild", response_model=SubscriptionRebuild
)
async def rebuild(
    auth_subject: VoidWrite,
    dry_run: bool = False,
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionRebuild:
    """Re-project the subscriptions table from the lifecycle events in the
    stream. `dry_run` only reports the differences: the consistency check."""
    return await subscription_service.rebuild(
        session, auth_subject.subject.id, apply=not dry_run
    )


@router.get(
    "/{id}", operation_id="subscriptions:get", response_model=ProductSubscription
)
async def get(
    id: uuid.UUID,
    auth_subject: VoidRead,
    session: AsyncSession = Depends(get_db_session),
) -> ProductSubscription:
    return to_schema(
        await subscription_service.get(session, auth_subject.subject.id, id), utc_now()
    )


@router.post(
    "/{id}/cancel",
    operation_id="subscriptions:cancel",
    response_model=ProductSubscription,
)
async def cancel(
    id: uuid.UUID,
    body: SubscriptionCancel,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ProductSubscription:
    subscription = await subscription_service.cancel(
        session, auth_subject.subject.id, id, body.at_period_end
    )
    return to_schema(subscription, utc_now())


@router.post(
    "/{id}/revoke",
    operation_id="subscriptions:revoke",
    response_model=ProductSubscription,
)
async def revoke(
    id: uuid.UUID,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ProductSubscription:
    """End access immediately."""
    subscription = await subscription_service.revoke(
        session, auth_subject.subject.id, id
    )
    return to_schema(subscription, utc_now())


@router.get(
    "/{id}/cycles",
    operation_id="subscriptions:cycles",
    response_model=list[SubscriptionCycle],
)
async def cycles(
    id: uuid.UUID,
    auth_subject: VoidRead,
    tinybird: TinybirdClient,
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[SubscriptionCycle]:
    """Closed periods with the fixed amount and each meter's usage priced."""
    return await subscription_service.cycles(
        session, tinybird, auth_subject.subject.id, id
    )
