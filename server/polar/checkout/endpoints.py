from fastapi import Depends

from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import Checkout, CheckoutCreate
from .service import checkout as checkout_service

router = APIRouter(
    prefix="/checkouts", tags=["checkouts", APITag.documented, APITag.featured]
)


@router.post("/", summary="Create Checkout", response_model=Checkout, status_code=201)
async def create(
    checkout_create: CheckoutCreate,
    auth_subject: auth.Checkout,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Create a checkout session."""
    return await checkout_service.create(session, checkout_create, auth_subject)


@router.get("/{id}", summary="Get Checkout", response_model=Checkout)
async def get(id: str, session: AsyncSession = Depends(get_db_session)) -> Checkout:
    """Get an active checkout session by ID."""
    return await checkout_service.get_by_id(session, id)
