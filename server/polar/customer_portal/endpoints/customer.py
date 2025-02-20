from typing import Annotated

from fastapi import Depends, Path, Request
from pydantic import UUID4
from sse_starlette import EventSourceResponse

from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import ResourceNotFound
from polar.models import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer import CustomerPortalCustomer

router = APIRouter(prefix="/customers", tags=["customers", APITag.documented])

CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/stream", include_in_schema=False)
async def stream(
    request: Request,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    receivers = Receivers(customer_id=auth_subject.subject.id)
    channels = receivers.get_channels()
    return EventSourceResponse(subscribe(redis, channels, request))


@router.get("/me", summary="Get Customer", response_model=CustomerPortalCustomer)
async def get(id: CustomerID, auth_subject: auth.CustomerPortalRead) -> Customer:
    """Get authenticated customer."""
    return auth_subject.subject
