from fastapi import APIRouter, Depends, HTTPException
import structlog
import stripe as stripe_lib

from polar.auth.dependencies import Auth
from polar.models import Organization
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session
from polar.integrations.stripe.service import stripe

from .schemas import (
    OrganizationRead,
    OrganizationSettingsUpdate,
    OrganizationSetupIntentRead,
    OrganizationStripeCustomerRead,
    PaymentMethod,
)
from .service import organization

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])


@router.get("/{platform}/{organization_name}", response_model=OrganizationRead)
async def get(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
) -> Organization:
    org = auth.organization
    return org


@router.put("/{platform}/{organization_name}/settings", response_model=OrganizationRead)
async def update_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    updated = await organization.update_settings(session, auth.organization, settings)
    return updated


@router.get(
    "/{platform}/{organization_name}/stripe_customer",
    response_model=OrganizationStripeCustomerRead,
)
async def get_stripe_customer(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationStripeCustomerRead:
    customer = await stripe.get_or_create_customer(session, auth.organization)

    if not customer:
        raise HTTPException(
            status_code=500, detail="Error could not get customer details"
        )

    default_payment_method: PaymentMethod | None = None
    if customer.invoice_settings.default_payment_method:
        payment_method = stripe.get_payment_method(
            customer.invoice_settings.default_payment_method
        )

        default_payment_method = PaymentMethod(
            type=payment_method.type,
        )

        if payment_method.type == "card":
            default_payment_method.card_brand = payment_method.card.brand
            default_payment_method.card_last4 = payment_method.card.last4

    return OrganizationStripeCustomerRead(
        email=customer.email,
        default_payment_method=default_payment_method,
    )


@router.post(
    "/{platform}/{organization_name}/setup_intent",
    response_model=OrganizationSetupIntentRead,
)
async def create_setup_intent(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSetupIntentRead:

    setup_intent = await stripe.create_setup_intent(session, auth.organization)

    if not setup_intent:
        raise HTTPException(status_code=500, detail="Error could not setup_intent")

    return OrganizationSetupIntentRead(
        id=setup_intent.id,
        status=setup_intent.status,
        client_secret=setup_intent.client_secret,
    )


@router.post(
    "/{platform}/{organization_name}/set_default_payment_method",
    response_model=OrganizationStripeCustomerRead,
)
async def set_default_payment_method(
    platform: Platforms,
    org_name: str,
    payment_method_id: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationStripeCustomerRead:
    await stripe.set_default_payment_method(
        session, auth.organization, payment_method_id
    )
    return await get_stripe_customer(platform, org_name, auth, session)
