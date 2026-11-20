from enum import StrEnum
from typing import NotRequired

from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitMeterCreditAllocation(StrEnum):
    per_claimed_seat = "per_claimed_seat"
    team = "team"


class BenefitMeterCreditProperties(BenefitProperties):
    meter_id: str
    units: int
    rollover: bool
    allocation: NotRequired[BenefitMeterCreditAllocation]


class BenefitGrantMeterCreditProperties(BenefitGrantProperties, total=False):
    last_credited_meter_id: str
    last_credited_units: int
    last_credited_at: str
