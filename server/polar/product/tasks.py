import uuid
from typing import Annotated

from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.models import Product
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

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
        repository = ProductRepository.from_session(session)
        product = await repository.get_by_id(
            product_id, options=(joinedload(Product.organization),)
        )
        if product is None:
            raise ProductDoesNotExist(product_id)

        await product_service.check_name(
            session, RedisMiddleware.get(), product, user_id=user_id
        )
