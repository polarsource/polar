from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.customer.schemas.customer import CustomerResponse as Customer
from polar.kit.schemas import (
    CUSTOMER_ID_EXAMPLE,
    METER_ID_EXAMPLE,
    IDSchema,
    Schema,
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


class CustomerMeterCreditsCreateBase(Schema):
    units: int = Field(
        gt=0,
        le=1_000_000_000,
        description="The number of units to credit.",
        examples=[100],
    )
    rollover: bool = Field(
        default=False,
        description="Whether unused credits carry over to the next meter period.",
    )
    external_id: str | None = Field(
        default=None,
        min_length=1,
        description=(
            "Your unique identifier for this credit. "
            "Retrying with the same `external_id` doesn't grant the credit twice."
        ),
    )


class CustomerMeterCreditsIDCreate(CustomerMeterCreditsCreateBase):
    """Schema to manually grant credits on a customer meter using Polar IDs."""

    customer_id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )


class CustomerMeterCreditsExternalIDCreate(CustomerMeterCreditsCreateBase):
    """Schema to manually grant credits on a customer meter using external IDs."""

    external_customer_id: str = Field(
        description="The external ID of the customer.", examples=["usr_1337"]
    )
    external_meter_id: str = Field(
        min_length=1,
        description="The external ID of the meter, as set by config as code.",
        examples=["tool_call"],
    )


CustomerMeterCreditsCreate = (
    CustomerMeterCreditsIDCreate | CustomerMeterCreditsExternalIDCreate
)
