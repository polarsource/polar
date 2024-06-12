import structlog
from fastapi import Depends

from polar.kit.routing import APIRouter
from polar.postgres import AsyncSession, get_db_session

from . import auth
from .schemas import Checkout, CheckoutCreate
from .service import checkout as checkout_service

log = structlog.get_logger()

router = APIRouter(prefix="/checkouts", tags=["checkouts"])


@router.post("/", response_model=Checkout, status_code=201)
async def create_checkout(
    checkout_create: CheckoutCreate,
    auth_subject: auth.Checkout,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    return await checkout_service.create(session, checkout_create, auth_subject)


@router.get("/{id}", response_model=Checkout)
async def get_checkout(
    id: str, session: AsyncSession = Depends(get_db_session)
) -> Checkout:
    return await checkout_service.get_by_id(session, id)
