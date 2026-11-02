import uuid
from typing import Annotated

from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.models import Product
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .name_check import judge_product_name
from .repository import ProductRepository
from .service import product as product_service


class ProductDoesNotExist(PolarTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        super().__init__(f"The product with id {product_id} does not exist.")


@actor(actor_name="product.check_name", priority=TaskPriority.LOW)
async def check_name(
    product_id: Annotated[uuid.UUID, LoggableField],
    user_id: Annotated[uuid.UUID | None, LoggableField] = None,
) -> None:
    async with AsyncSessionMaker() as session:
        product = await ProductRepository.from_session(session).get_by_id(product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)
        name = product.name

    # The decision model is a network call: don't hold a connection during it.
    check = await judge_product_name(name)
    if check is None:
        return

    async with AsyncSessionMaker() as session:
        product = await ProductRepository.from_session(session).get_by_id(
            product_id, options=(joinedload(Product.organization),)
        )
        # A rename since enqueueing has its own check queued.
        if product is None or product.name != name:
            return

        await product_service.record_name_check(
            session, RedisMiddleware.get(), product, check, user_id=user_id
        )
