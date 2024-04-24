import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.auth.dependencies import WebOrAnonymous, WebUser
from polar.auth.models import is_user
from polar.authz.service import AccessType, Authz
from polar.currency.schemas import CurrencyAmount
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.issue.service import issue as issue_service
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models.organization import Organization
from polar.organization.dependencies import OrganizationNamePlatform
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    Donation,
    DonationCreateStripePaymentIntent,
    DonationStatistics,
    DonationStripePaymentIntentMutationResponse,
    DonationUpdateStripePaymentIntent,
    PublicDonation,
)
from .service import SearchSortProperty, donation_service

router = APIRouter(tags=["donations"])


SearchSorting = Annotated[
    list[Sorting[SearchSortProperty]],
    Depends(SortingGetter(SearchSortProperty, ["-created_at"])),
]


@router.get(
    "/donations/search",
    response_model=ListResource[Donation],
    tags=[Tags.PUBLIC],
)
async def search_donations(
    pagination: PaginationParamsQuery,
    to_organization_id: UUID4,
    sorting: SearchSorting,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[Donation]:
    to_organization = await organization_service.get(session, to_organization_id)
    if not to_organization:
        raise ResourceNotFound("Organization not found")
    if not await authz.can(auth_subject.subject, AccessType.write, to_organization):
        raise Unauthorized()

    results, count = await donation_service.search(
        session,
        to_organization=to_organization,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Donation.from_db(result) for result in results],
        count,
        pagination,
    )


@router.post(
    "/donations/payment_intent",
    response_model=DonationStripePaymentIntentMutationResponse,
)
async def create_payment_intent(
    intent: DonationCreateStripePaymentIntent,
    auth_subject: WebOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> DonationStripePaymentIntentMutationResponse:
    to_organization = await organization_service.get(session, intent.to_organization_id)
    if not to_organization:
        raise ResourceNotFound()

    if not to_organization.donations_enabled:
        raise BadRequest("This organization does not accept donations")

    # If on behalf of org, check that user is member of this org.
    on_behalf_of_organization: Organization | None = None
    if intent.on_behalf_of_organization_id:
        if not is_user(auth_subject):
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, intent.on_behalf_of_organization_id
        )
        if not member:
            raise Unauthorized()

        # get org
        on_behalf_of_organization = await organization_service.get(
            session, intent.on_behalf_of_organization_id
        )
        if not on_behalf_of_organization:
            raise ResourceNotFound()

    # If linked to issue, make sure that the issue exists and is for the same org
    if intent.issue_id:
        issue = await issue_service.get(session, intent.issue_id)
        if not issue:
            raise ResourceNotFound("Issue not found")
        if issue.organization_id != to_organization.id:
            raise BadRequest("The linked issue does not belong to to_organization")

    pi = await donation_service.create_payment_intent(
        session=session,
        amount=intent.amount,
        receipt_email=intent.email,
        to_organization=to_organization,
        message=intent.message,
        by_user=auth_subject.subject if is_user(auth_subject) else None,
        by_organization=None,
        on_behalf_of_organization=on_behalf_of_organization,
        issue_id=intent.issue_id,
    )

    return DonationStripePaymentIntentMutationResponse(
        payment_intent_id=pi.id,
        amount=intent.amount,
        fee=CurrencyAmount(currency="USD", amount=0),
        amount_including_fee=intent.amount,
        client_secret=pi.client_secret,
    )


@router.patch(
    "/donations/payment_intent/{id}",
    response_model=DonationStripePaymentIntentMutationResponse,
)
async def update_payment_intent(
    id: str,
    updates: DonationUpdateStripePaymentIntent,
    auth_subject: WebOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> DonationStripePaymentIntentMutationResponse:
    # If on behalf of org, check that user is member of this org.
    on_behalf_of_organization: Organization | None = None
    if updates.on_behalf_of_organization_id:
        if not is_user(auth_subject):
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, updates.on_behalf_of_organization_id
        )
        if not member:
            raise Unauthorized()

        # get org
        on_behalf_of_organization = await organization_service.get(
            session, updates.on_behalf_of_organization_id
        )
        if not on_behalf_of_organization:
            raise ResourceNotFound()

    pi = await donation_service.update_payment_intent(
        session=session,
        payment_intent_id=id,
        amount=updates.amount,
        receipt_email=updates.email,
        setup_future_usage=updates.setup_future_usage,
        message=updates.message,
        by_user=auth_subject.subject if is_user(auth_subject) else None,
        by_organization=None,
        on_behalf_of_organization=on_behalf_of_organization,
    )

    return DonationStripePaymentIntentMutationResponse(
        payment_intent_id=pi.id,
        amount=updates.amount,
        fee=CurrencyAmount(currency="USD", amount=0),
        amount_including_fee=updates.amount,
        client_secret=pi.client_secret,
    )


@router.get(
    "/donations/statistics",
    response_model=DonationStatistics,
    tags=[Tags.PUBLIC],
)
async def statistics(
    auth_subject: WebUser,
    to_organization_id: UUID4,
    start_date: datetime.date = Query(...),
    end_date: datetime.date = Query(...),
    interval: Literal["month", "week", "day"] = Query(..., alias="donationsInterval"),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> DonationStatistics:
    org = await organization_service.get(session, to_organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    res = await donation_service.statistics(
        session,
        to_organization_id=to_organization_id,
        start_date=start_date,
        end_date=end_date,
        start_of_last_period=end_date,
        interval=interval,
    )

    return DonationStatistics(periods=res)


@router.get(
    "/donations/public/search",
    response_model=ListResource[PublicDonation],
    tags=[Tags.PUBLIC],
)
async def donations_public_search(
    pagination: PaginationParamsQuery,
    organization_name_platform: OrganizationNamePlatform,
    sorting: SearchSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PublicDonation]:
    organization_name, platform = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    results, count = await donation_service.search(
        session, to_organization=org, pagination=pagination, sorting=sorting
    )

    return ListResource.from_paginated_results(
        [
            PublicDonation.from_db(
                result, include_created_at=org.public_donation_timestamps
            )
            for result in results
        ],
        count,
        pagination,
    )
