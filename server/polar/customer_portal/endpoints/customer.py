from typing import Annotated

from fastapi import Depends, Path
from pydantic import UUID4

from polar.auth.models import is_customer, is_user
from polar.customer.service import customer as customer_service
from polar.exceptions import ResourceNotFound
from polar.models import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer import CustomerPortalCustomer

router = APIRouter(prefix="/customers", tags=["customers", APITag.documented])

CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
CustomerNotFound = {
    "description": "Customer not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{id}",
    summary="Get Customer",
    response_model=CustomerPortalCustomer,
    responses={404: CustomerNotFound},
)
async def get(
    id: CustomerID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """Get a customer by ID for the authenticated customer or user."""
    customer: Customer | None = None
    if is_user(auth_subject):
        customer = await customer_service.get_by_id_and_user(
            session, id, auth_subject.subject
        )
    elif is_customer(auth_subject) and auth_subject.subject.id == id:
        customer = auth_subject.subject

    if customer is None:
        raise ResourceNotFound()

    return customer
