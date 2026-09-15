from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import IDSchema, Schema


class CustomerCreate(Schema):
    external_id: str = Field(min_length=1, max_length=255, pattern=r"\S")
    email: EmailStrDNS
    name: str | None = Field(default=None, max_length=256)
    customer_id: UUID | None = Field(
        default=None,
        description="Existing Polar customer to bind. Its external ID must match or be unset.",
    )


class Customer(IDSchema):
    external_id: str
    email: str | None
    name: str | None
    created_at: datetime
