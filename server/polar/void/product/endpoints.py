from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite

from .schemas import Product, ProductCreate, to_schema
from .service import ProductInvalid
from .service import product as product_service

router = APIRouter(prefix="/products", tags=["products"], include_in_schema=False)


@router.get("", response_model=list[Product], operation_id="products:list")
async def list_products(
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    include_archived: bool = False,
) -> Sequence[Product]:
    products = await product_service.list(
        session, auth_subject.subject.id, include_archived=include_archived
    )
    return [to_schema(product) for product in products]


@router.post(
    "",
    response_model=Product,
    status_code=201,
    operation_id="products:create",
    responses={
        404: {"model": ResourceNotFound.schema()},
        400: {"model": ProductInvalid.schema()},
    },
)
async def create_product(
    body: ProductCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    return to_schema(
        await product_service.create(session, auth_subject.subject.id, body)
    )


@router.get(
    "/{id}",
    response_model=Product,
    operation_id="products:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_product(
    id: UUID,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Product:
    return to_schema(await product_service.get(session, auth_subject.subject.id, id))
