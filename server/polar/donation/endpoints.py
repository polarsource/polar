from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import UUID4

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz
from polar.currency.schemas import CurrencyAmount
from polar.donation.schemas import (
    Donation,
    DonationCreateStripePaymentIntent,
    DonationStripePaymentIntentMutationResponse,
    DonationUpdateStripePaymentIntent,
)
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models.organization import Organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.user_organization.service import (
    user_organization as user_organization_service,
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
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[Donation]:
    to_organization = await organization_service.get(session, to_organization_id)
    if not to_organization:
        raise ResourceNotFound("Organization not found")
    if not await authz.can(auth.subject, AccessType.write, to_organization):
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
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> DonationStripePaymentIntentMutationResponse:
    to_organization = await organization_service.get(session, intent.to_organization_id)
    if not to_organization:
        raise ResourceNotFound()

    if not to_organization.donations_enabled:
        raise BadRequest("This organization does not accept donations")

    # If on behalf of org, check that user is member of this org.
    on_behalf_of_organization: Organization | None = None
    if intent.on_behalf_of_organization_id:
        if not auth.user:
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth.user.id, intent.on_behalf_of_organization_id
        )
        if not member:
            raise Unauthorized()

        # get org
        on_behalf_of_organization = await organization_service.get(
            session, intent.on_behalf_of_organization_id
        )
        if not on_behalf_of_organization:
            raise ResourceNotFound()

    pi = await donation_service.create_payment_intent(
        session=session,
        amount=intent.amount,
        receipt_email=intent.email,
        to_organization=to_organization,
        message=intent.message,
        by_user=auth.user,
        by_organization=None,
        on_behalf_of_organization=on_behalf_of_organization,
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
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> DonationStripePaymentIntentMutationResponse:
    # If on behalf of org, check that user is member of this org.
    on_behalf_of_organization: Organization | None = None
    if updates.on_behalf_of_organization_id:
        if not auth.user:
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth.user.id, updates.on_behalf_of_organization_id
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
        by_user=auth.user,
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
