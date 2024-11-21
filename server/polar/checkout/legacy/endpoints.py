from fastapi import Depends

from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import CheckoutLegacy, CheckoutLegacyCreate
from .service import checkout as checkout_service

router = APIRouter(
    prefix="/checkouts", tags=["checkouts", APITag.documented], deprecated=True
)

_deprecation_message = (
    "This API is deprecated. "
    "We recommend you to use the new custom checkout API, "
    "which is more flexible and powerful. "
    "Please refer to the documentation for more information."
)


@router.post(
    "/",
    summary="Create Checkout",
    response_model=CheckoutLegacy,
    status_code=201,
    openapi_extra={
        "x-speakeasy-deprecation-replacement": "checkouts:custom:create",
        "x-speakeasy-deprecation-message": _deprecation_message,
    },
)
async def create(
    checkout_create: CheckoutLegacyCreate,
    auth_subject: auth.Checkout,
    session: AsyncSession = Depends(get_db_session),
) -> CheckoutLegacy:
    """Create a checkout session."""
    return await checkout_service.create(session, checkout_create, auth_subject)


@router.get(
    "/{id}",
    summary="Get Checkout",
    response_model=CheckoutLegacy,
    openapi_extra={
        "x-speakeasy-deprecation-message": _deprecation_message,
    },
)
async def get(
    id: str, session: AsyncSession = Depends(get_db_session)
) -> CheckoutLegacy:
    """Get an active checkout session by ID."""
    return await checkout_service.get_by_id(session, id)
