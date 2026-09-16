from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter
from polar.void.auth import VoidRead

from .schemas import Product, to_schema
from .service import product as product_service

router = APIRouter(prefix="/products", tags=["products"], include_in_schema=False)


@router.get("", response_model=list[Product], operation_id="products:list")
async def list_products(
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    version_id: str | None = None,
) -> Sequence[Product]:
    products = await product_service.list(session, auth_subject.subject.id)
    return [
        to_schema(product)
        for product in products
        if version_id is None or product.version_id == version_id
    ]


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
