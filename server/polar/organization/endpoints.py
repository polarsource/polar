from fastapi import APIRouter, Depends, HTTPException
import structlog

from polar.auth.dependencies import Auth
from polar.models import Organization
from polar.enums import Platforms
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.integrations.stripe.service import stripe
from polar.user_organization.schemas import UserOrganizationSettingsUpdate
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    OrganizationRead,
    OrganizationSettingsUpdate,
    OrganizationSetupIntentRead,
    OrganizationStripeCustomerRead,
    OrganizationSyncedRead,
    OrganizationSyncedRepositoryRead,
    PaymentMethod,
)
from .service import organization

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])


@router.get("/{platform}/{org_name}", response_model=OrganizationRead)
async def get(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationRead:
    return await _get_org_for_user(session, auth.organization, auth.user)


async def _get_org_for_user(
    session: AsyncSession, org: Organization, user: User
) -> OrganizationRead:
    res = OrganizationRead.from_orm(org)

    # Get personal settings
    settings = await user_organization_service.get_settings(session, user.id, org.id)
    res.email_notification_maintainer_issue_receives_backing = (
        settings.email_notification_maintainer_issue_receives_backing
    )
    res.email_notification_maintainer_issue_branch_created = (
        settings.email_notification_maintainer_issue_branch_created
    )
    res.email_notification_maintainer_pull_request_created = (
        settings.email_notification_maintainer_pull_request_created
    )
    res.email_notification_maintainer_pull_request_merged = (
        settings.email_notification_maintainer_pull_request_merged
    )
    res.email_notification_backed_issue_branch_created = (
        settings.email_notification_backed_issue_branch_created
    )
    res.email_notification_backed_issue_pull_request_created = (
        settings.email_notification_backed_issue_pull_request_created
    )
    res.email_notification_backed_issue_pull_request_merged = (
        settings.email_notification_backed_issue_pull_request_merged
    )

    return res


@router.put("/{platform}/{org_name}/settings", response_model=OrganizationRead)
async def update_settings(
    platform: Platforms,
    org_name: str,
    settings: OrganizationSettingsUpdate,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationRead:
    updated = await organization.update_settings(session, auth.organization, settings)

    # update user settings
    user_settings = UserOrganizationSettingsUpdate(
        email_notification_maintainer_issue_receives_backing=settings.email_notification_maintainer_issue_receives_backing,
        email_notification_maintainer_issue_branch_created=settings.email_notification_maintainer_issue_branch_created,
        email_notification_maintainer_pull_request_created=settings.email_notification_maintainer_pull_request_created,
        email_notification_maintainer_pull_request_merged=settings.email_notification_maintainer_pull_request_merged,
        email_notification_backed_issue_branch_created=settings.email_notification_backed_issue_branch_created,
        email_notification_backed_issue_pull_request_created=settings.email_notification_backed_issue_pull_request_created,
        email_notification_backed_issue_pull_request_merged=settings.email_notification_backed_issue_pull_request_merged,
    )
    await user_organization_service.update_settings(
        session, auth.user.id, auth.organization.id, user_settings
    )

    return await _get_org_for_user(session, updated, auth.user)


@router.get(
    "/{platform}/{org_name}/stripe_customer",
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
    "/{platform}/{org_name}/setup_intent",
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
    "/{platform}/{org_name}/set_default_payment_method",
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


@router.get("/{platform}/{org_name}/synced", response_model=OrganizationSyncedRead)
async def get_synced(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSyncedRead:
    counts = await organization.repositories_issues_synced(session, auth.organization)
    return OrganizationSyncedRead(
        repos=[
            OrganizationSyncedRepositoryRead(id=k, synced_issues_count=counts[k])
            for k in counts
        ]
    )
