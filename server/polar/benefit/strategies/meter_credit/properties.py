from pydantic import UUID4

from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitMeterCreditProperties(BenefitProperties):
    meter_id: UUID4
    units: int


class BenefitGrantMeterCreditProperties(BenefitGrantProperties):
    last_credited_units: int
    last_credited_at: str
