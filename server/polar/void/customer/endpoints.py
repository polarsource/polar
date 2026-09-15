from collections.abc import Sequence

from fastapi import Depends

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

from .schemas import Customer, CustomerCreate
from .service import CustomerBindingConflict
from .service import customer as customer_service

router = APIRouter(
    prefix="/customers", tags=["customers", APITag.private], include_in_schema=False
)


@router.get("", response_model=list[Customer], operation_id="customers:list")
async def list_customers(
    auth_subject: VoidCustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[Customer]:
    return await customer_service.list(session, auth_subject)


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
    auth_subject: VoidCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await customer_service.create(session, auth_subject, body)


@router.get(
    "/{external_id}",
    response_model=Customer,
    operation_id="customers:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_customer(
    external_id: str,
    auth_subject: VoidCustomerRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Customer:
    return await customer_service.get(session, auth_subject, external_id)
