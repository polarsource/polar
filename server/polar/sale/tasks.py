import uuid

import structlog

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from ..product.service.product import product as product_service
from .service import sale as sale_service

log: Logger = structlog.get_logger()


class SaleTaskError(PolarTaskError): ...


class ProductDoesNotExist(SaleTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        message = f"The product with id {product_id} does not exist."
        super().__init__(message)


@task("sale.update_product_benefits_grants")
async def update_product_benefits_grants(
    ctx: JobContext, product_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        product = await product_service.get(session, product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        await sale_service.update_product_benefits_grants(session, product)
