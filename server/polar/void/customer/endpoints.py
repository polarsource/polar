from collections.abc import Sequence

from fastapi import Depends
from pydantic import AwareDatetime

from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidCustomerRead, VoidCustomerWrite
from polar.void.organization.service import selected_version
from polar.void.postgres import get_snapshot_session
from polar.void.tinybird import TinybirdClient

from .schemas import Customer, CustomerCreate, CustomerState
from .service import CustomerBindingConflict
from .service import customer as customer_service
from .state import customer_state

router = APIRouter(
    prefix="/customers", tags=["customers", APITag.private], include_in_schema=False
)


@router.get("", response_model=list[Customer], operation_id="customers:list")
async def list_customers(
    auth: VoidCustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[Customer]:
    return await customer_service.list(session, auth)


@router.post(
    "",
    response_model=Customer,
    status_code=201,
    operation_id="customers:create",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": CustomerBindingConflict.schema()},
    },
)
async def create_customer(
    body: CustomerCreate,
    auth: VoidCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await customer_service.create(session, auth, body)


@router.get(
    "/{external_id}",
    response_model=Customer,
    operation_id="customers:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_customer(
    external_id: str,
    auth: VoidCustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Customer:
    return await customer_service.get(session, auth, external_id)


@router.get(
    "/{external_id}/state",
    response_model=CustomerState,
    operation_id="customers:state",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def state(
    external_id: str,
    auth: VoidCustomerRead,
    tinybird: TinybirdClient,
    since: AwareDatetime | None = None,
    version_id: str | None = None,
    session: AsyncSession = Depends(get_snapshot_session),
) -> CustomerState:
    return await customer_state(
        session,
        tinybird,
        auth,
        external_id,
        since,
        await selected_version(session, auth.organization_id, version_id),
    )
