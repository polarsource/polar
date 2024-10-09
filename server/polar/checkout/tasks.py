import uuid

from polar.exceptions import PolarTaskError
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    task,
)

from .service import checkout as checkout_service


class CheckoutTaskError(PolarTaskError): ...


@task("checkout.handle_free_success")
async def handle_free_success(
    ctx: JobContext, checkout_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await checkout_service.handle_free_success(session, checkout_id)
