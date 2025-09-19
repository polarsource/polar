from typing import Annotated, TypedDict

import structlog
from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.kit.tax import calculate_tax
from polar.locker import Locker, get_locker
from polar.models import Subscription
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter
from polar.subscription.schemas import SubscriptionID
from polar.subscription.service import AlreadyCanceledSubscription
from polar.subscription.service import subscription as subscription_service

from .. import auth
from ..schemas.subscription import CustomerSubscription, CustomerSubscriptionUpdate
from ..service.subscription import CustomerSubscriptionSortProperty
from ..service.subscription import (
    customer_subscription as customer_subscription_service,
)

log = structlog.get_logger()

router = APIRouter(prefix="/subscriptions", tags=["subscriptions", APITag.public])

SubscriptionNotFound = {
    "description": "Customer subscription was not found.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[CustomerSubscriptionSortProperty]],
    Depends(SortingGetter(CustomerSubscriptionSortProperty, ["-started_at"])),
]


@router.get(
    "/", summary="List Subscriptions", response_model=ListResource[CustomerSubscription]
)
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    active: bool | None = Query(
        None,
        description=("Filter by active or cancelled subscription."),
    ),
    query: str | None = Query(
        None, description="Search by product or organization name."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerSubscription]:
    """List subscriptions of the authenticated customer."""
    results, count = await customer_subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        active=active,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerSubscription.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Subscription",
    response_model=CustomerSubscription,
    responses={404: SubscriptionNotFound},
)
async def get(
    id: SubscriptionID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Get a subscription for the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    return subscription


class SubscriptionChargePreviewResponse(TypedDict):
    base_amount: int
    metered_amount: int
    subtotal_amount: int
    discount_amount: int
    tax_amount: int
    total_amount: int


@router.get(
    "/{id}/charge-preview",
    summary="Preview Next Charge For Active Subscription",
    response_model=SubscriptionChargePreviewResponse,
    responses={404: SubscriptionNotFound},
    tags=[APITag.private],
)
async def get_charge_preview(
    id: SubscriptionID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionChargePreviewResponse:
    """Get current period usage and cost breakdown for a subscription."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    if subscription.status != "active":
        ## FIXME Is a 404 the correct behavior?
        raise ResourceNotFound()

    base_price = sum(p.amount for p in subscription.subscription_product_prices)

    metered_amount = sum(meter.amount for meter in subscription.meters)

    subtotal_amount = base_price + metered_amount

    discount_amount = 0

    applicable_discount = None

    # Ensure the discount has not expired yet for the next charge (so at current_period_end)
    if subscription.discount is not None:
        assert subscription.started_at is not None
        assert subscription.current_period_end is not None
        if not subscription.discount.is_repetition_expired(
            subscription.started_at, subscription.current_period_end
        ):
            applicable_discount = subscription.discount

    if applicable_discount is not None:
        discount_amount = applicable_discount.get_discount_amount(subtotal_amount)

    taxable_amount = subtotal_amount - discount_amount

    tax_amount = 0

    if (
        subscription.product.is_tax_applicable
        and subscription.customer.billing_address is not None
    ):
        assert subscription.product.stripe_product_id is not None
        tax = await calculate_tax(
            subscription.id,
            subscription.currency,
            taxable_amount,
            subscription.product.stripe_product_id,
            subscription.customer.billing_address,
            [subscription.customer.tax_id]
            if subscription.customer.tax_id is not None
            else [],
            subscription.tax_exempted,
        )

        tax_amount = tax["amount"]

    total = taxable_amount + tax_amount

    return {
        "base_amount": base_price,
        "metered_amount": metered_amount,
        "subtotal_amount": subtotal_amount,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total,
    }


@router.patch(
    "/{id}",
    summary="Update Subscription",
    response_model=CustomerSubscription,
    responses={
        200: {"description": "Customer subscription updated."},
        403: {
            "description": (
                "Customer subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def update(
    id: SubscriptionID,
    subscription_update: CustomerSubscriptionUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Subscription:
    """Update a subscription of the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "customer_portal.subscription.cancel",
        id=id,
        customer_id=auth_subject.subject.id,
        updates=subscription_update,
    )
    async with subscription_service.lock(locker, subscription):
        return await customer_subscription_service.update(
            session, subscription, updates=subscription_update
        )


@router.delete(
    "/{id}",
    summary="Cancel Subscription",
    response_model=CustomerSubscription,
    responses={
        200: {"description": "Customer subscription is canceled."},
        403: {
            "description": (
                "Customer subscription is already canceled "
                "or will be at the end of the period."
            ),
            "model": AlreadyCanceledSubscription.schema(),
        },
        404: SubscriptionNotFound,
    },
)
async def cancel(
    id: SubscriptionID,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Subscription:
    """Cancel a subscription of the authenticated customer."""
    subscription = await customer_subscription_service.get_by_id(
        session, auth_subject, id
    )

    if subscription is None:
        raise ResourceNotFound()

    log.info(
        "customer_portal.subscription.cancel",
        id=id,
        customer_id=auth_subject.subject.id,
    )
    async with subscription_service.lock(locker, subscription):
        return await customer_subscription_service.cancel(session, subscription)
