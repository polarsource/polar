import uuid
from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent, build_system_event
from polar.kit.utils import utc_now
from polar.meter.repository import MeterRepository
from polar.models import Benefit, Customer, Organization, User

from ..base.service import BenefitPropertiesValidationError, BenefitServiceProtocol
from .properties import BenefitGrantMeterCreditProperties, BenefitMeterCreditProperties


class BenefitMeterCreditService(
    BenefitServiceProtocol[
        BenefitMeterCreditProperties, BenefitGrantMeterCreditProperties
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantMeterCreditProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantMeterCreditProperties:
        properties = self._get_properties(benefit)
        return await self._create_event(
            customer, meter_id=properties["meter_id"], units=properties["units"]
        )

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantMeterCreditProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantMeterCreditProperties:
        properties = self._get_properties(benefit)
        return await self._create_event(
            customer, meter_id=properties["meter_id"], units=properties["units"]
        )

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantMeterCreditProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantMeterCreditProperties:
        properties = self._get_properties(benefit)

        units = -grant_properties.get("last_credited_units", properties["units"])
        return await self._create_event(
            customer, meter_id=properties["meter_id"], units=units
        )

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitMeterCreditProperties
    ) -> bool:
        return False

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitMeterCreditProperties:
        meter_repository = MeterRepository.from_session(self.session)
        meter = await meter_repository.get_readable_by_id(
            properties["meter_id"], auth_subject
        )
        if meter is None:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": "This meter does not exist.",
                        "loc": ("meter_id",),
                        "input": properties["meter_id"],
                    }
                ]
            )

        return cast(BenefitMeterCreditProperties, properties)

    async def _create_event(
        self, customer: Customer, *, meter_id: uuid.UUID, units: int
    ) -> BenefitGrantMeterCreditProperties:
        event_repository = EventRepository.from_session(self.session)
        event = await event_repository.create(
            build_system_event(
                SystemEvent.meter_credited,
                customer=customer,
                metadata={
                    "meter_id": str(meter_id),
                    "units": units,
                },
            )
        )
        return {
            "last_credited_units": units,
            "last_credited_at": utc_now().isoformat(),
        }
