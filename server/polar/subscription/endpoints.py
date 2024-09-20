from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import Depends, Query, Response
from fastapi.responses import StreamingResponse

from polar.kit.csv import (
    IterableCSVWriter,
)
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth
from .schemas import Subscription as SubscriptionSchema
from .service import SubscriptionSortProperty
from .service import subscription as subscription_service

log = structlog.get_logger()

router = APIRouter(prefix="/subscriptions", tags=["subscriptions", APITag.documented])


SearchSorting = Annotated[
    list[Sorting[SubscriptionSortProperty]],
    Depends(SortingGetter(SubscriptionSortProperty, ["-started_at"])),
]


@router.get(
    "/", response_model=ListResource[SubscriptionSchema], summary="List Subscriptions"
)
async def list(
    auth_subject: auth.SubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    active: bool | None = Query(
        None, description="Filter by active or inactive subscription."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SubscriptionSchema]:
    """List subscriptions."""
    results, count = await subscription_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        active=active,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [SubscriptionSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/export", summary="Export Subscriptions")
async def export(
    auth_subject: auth.SubscriptionsRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export subscriptions as a CSV file."""

    async def create_csv() -> AsyncGenerator[str, None]:
        csv_writer = IterableCSVWriter(dialect="excel")
        # CSV header
        yield csv_writer.getrow(
            (
                "Email",
                "Name",
                "Created At",
                "Active",
                "Product",
                "Price",
                "Currency",
                "Interval",
            )
        )

        (subscribers, _) = await subscription_service.list(
            session,
            auth_subject,
            organization_id=organization_id,
            pagination=PaginationParams(limit=1000000, page=1),
        )

        for sub in subscribers:
            yield csv_writer.getrow(
                (
                    sub.user.email,
                    sub.user.username_or_email,
                    sub.created_at.isoformat(),
                    "true" if sub.active else "false",
                    sub.product.name,
                    sub.amount / 100 if sub.amount is not None else "",
                    sub.currency if sub.currency is not None else "",
                    sub.recurring_interval,
                )
            )

    filename = "polar-subscribers.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
