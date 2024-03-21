from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar import locker
from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz, Subject
from polar.currency.schemas import CurrencyAmount
from polar.donation.schemas import (
    DonationCreateStripePaymentIntent,
    DonationStripePaymentIntentMutationResponse,
)
from polar.enums import Platforms
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.issue.service import issue as issue_service
from polar.kit.pagination import ListResource, Pagination
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .service import donation_service

router = APIRouter(tags=["donations"])


@router.post(
    "/donations/payment_intent",
    response_model=DonationStripePaymentIntentMutationResponse,
)
async def create_payment_intent(
    intent: DonationCreateStripePaymentIntent,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> DonationStripePaymentIntentMutationResponse:
    to_organization = await organization_service.get(session, intent.to_organization_id)
    if not to_organization:
        raise ResourceNotFound()

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

    # TODO: fees

    pi = await donation_service.create_payment_intent(
        session=session,
        user=auth.user,
        amount=intent.amount,
        receipt_email=intent.email,
        to_organization=to_organization,
        on_behalf_of_organization=on_behalf_of_organization,
    )

    return DonationStripePaymentIntentMutationResponse(
        payment_intent_id=pi.id,
        amount=intent.amount,
        fee=CurrencyAmount(currency="USD", amount=0),
        amount_including_fee=intent.amount,
        client_secret=pi.client_secret,
    )
