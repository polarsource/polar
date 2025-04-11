from pydantic import Field

from polar.customer_meter.schemas import CustomerMeterBase
from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.meter.schemas import NAME_DESCRIPTION as METER_NAME_DESCRIPTION


class CustomerCustomerMeterMeter(IDSchema, TimestampedSchema):
    name: str = Field(description=METER_NAME_DESCRIPTION)


class CustomerCustomerMeter(CustomerMeterBase):
    meter: CustomerCustomerMeterMeter
