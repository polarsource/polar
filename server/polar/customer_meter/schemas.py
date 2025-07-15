from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.customer.schemas.customer import Customer
from polar.kit.schemas import (
    CUSTOMER_ID_EXAMPLE,
    METER_ID_EXAMPLE,
    IDSchema,
    TimestampedSchema,
)
from polar.meter.schemas import Meter

CustomerMeterID = Annotated[UUID4, Path(description="The customer meter ID.")]


class CustomerMeterBase(TimestampedSchema, IDSchema):
    customer_id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )
    consumed_units: float = Field(
        description="The number of consumed units.", examples=[25.0]
    )
    credited_units: int = Field(
        description="The number of credited units.", examples=[100]
    )
    balance: float = Field(
        description=(
            "The balance of the meter, "
            "i.e. the difference between credited and consumed units."
        ),
        examples=[75.0],
    )


class CustomerMeter(CustomerMeterBase):
    """An active customer meter, with current consumed and credited units."""

    customer: Customer = Field(description="The customer associated with this meter.")
    meter: Meter = Field(description="The meter associated with this customer.")
