from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.enums import UserSignupType
from polar.exceptions import PolarRequestValidationError
from polar.kit.csv import (
    IterableCSVWriter,
    get_emails_from_csv,
    get_iterable_from_binary_io,
)
from polar.kit.pagination import ListResource, PaginationParams, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Subscription
from polar.models.product import SubscriptionTierType
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.service.user import user as user_service

from ..product.service.product import product as product_service
from . import auth
from .schemas import Subscription as SubscriptionSchema
from .schemas import SubscriptionCreateEmail, SubscriptionsImported
from .service import AlreadySubscribed, SearchSortProperty
from .service import subscription as subscription_service

log = structlog.get_logger()

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


SearchSorting = Annotated[
    list[Sorting[SearchSortProperty]],
    Depends(SortingGetter(SearchSortProperty, ["-started_at"])),
]


@router.get(
    "/", response_model=ListResource[SubscriptionSchema], summary="List Subscriptions"
)
async def list(
    auth_subject: auth.SubscriptionsRead,
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    product_id: UUID4 | None = Query(None, description="Filter by product ID."),
    type: SubscriptionTierType | None = Query(
        None, description="Filter by tier type.", deprecated=True
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
        type=type,
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


@router.post(
    "/",
    response_model=SubscriptionSchema,
    status_code=201,
    summary="Create Free Subscription",
)
async def create(
    subscription_create: SubscriptionCreateEmail,
    auth_subject: auth.SubscriptionsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Subscription:
    """Create a subscription on the free tier for a given email."""
    product = await product_service.get(session, subscription_create.product_id)
    if product is None:
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "product_id"),
                    "msg": "Product does not exist.",
                    "type": "value_error",
                    "input": subscription_create.product_id,
                }
            ]
        )

    await session.refresh(product, {"organization"})
    if not await authz.can(
        auth_subject.subject, AccessType.write, product.organization
    ):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "product_id"),
                    "msg": "Product does not exist.",
                    "type": "value_error",
                    "input": subscription_create.product_id,
                }
            ]
        )

    if product.type != SubscriptionTierType.free:
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "product_id"),
                    "msg": "Product is not the free tier.",
                    "type": "value_error",
                    "input": subscription_create.product_id,
                }
            ]
        )

    user = await user_service.get_by_email_or_signup(
        session, subscription_create.email, signup_type=UserSignupType.imported
    )
    subscription = await subscription_service.create_arbitrary_subscription(
        session, user=user, product=product
    )

    return subscription


@router.post(
    "/import",
    response_model=SubscriptionsImported,
    # Set operation ID manually because `import` is a reserved keyword.
    operation_id="subscriptions:import",
    summary="Import Subscriptions",
)
async def subscriptions_import(
    auth_subject: auth.SubscriptionsWrite,
    file: Annotated[UploadFile, File(description="CSV file with emails.")],
    organization_id: Annotated[
        UUID4,
        Form(description="The organization ID on which to import the subscriptions."),
    ],
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionsImported:
    """Import subscriptions from a CSV file."""
    organization = await organization_service.get(session, organization_id)
    if organization is None or not await authz.can(
        auth_subject.subject, AccessType.write, organization
    ):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "organization_id"),
                    "msg": "Organization does not exist.",
                    "type": "value_error",
                    "input": organization_id,
                }
            ]
        )

    free_tier = await product_service.get_free(session, organization=organization)
    if free_tier is None:
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "organization_id"),
                    "msg": "Organization does not have a free tier.",
                    "type": "value_error",
                    "input": organization_id,
                }
            ]
        )

    emails = get_emails_from_csv(get_iterable_from_binary_io(file.file))

    count = 0

    for email in emails:
        try:
            user = await user_service.get_by_email_or_signup(
                session, email, signup_type=UserSignupType.imported
            )
            await subscription_service.create_arbitrary_subscription(
                session, user=user, product=free_tier
            )
            count += 1
        except AlreadySubscribed:
            pass
        except Exception as e:
            log.error("subscriptions_import.failed", e=e)

    return SubscriptionsImported(count=count)


@router.get("/export", summary="Export Subscriptions")
async def export(
    auth_subject: auth.SubscriptionsRead,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export subscriptions as a CSV file."""

    async def create_csv() -> AsyncGenerator[str, None]:
        csv_writer = IterableCSVWriter(dialect="excel")
        # CSV header
        yield csv_writer.getrow(
            ("Email", "Name", "Created At", "Active", "Product", "Price", "Currency")
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
                    sub.price.price_amount / 100 if sub.price is not None else "",
                    sub.price.price_currency if sub.price is not None else "",
                )
            )

    filename = "polar-subscribers.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
