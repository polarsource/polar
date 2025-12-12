import uuid
from datetime import datetime
from typing import Any, cast

from polar.auth.models import AuthSubject
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.event.system import SystemEvent, build_system_event
from polar.kit.utils import utc_now
from polar.locker import Locker
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
        meter_id = uuid.UUID(properties["meter_id"])
        return await self._create_event(
            customer,
            benefit.organization,
            meter_id=meter_id,
            units=properties["units"],
            rollover=properties["rollover"],
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
        meter_id = uuid.UUID(properties["meter_id"])

        # Reset the meter on cycle
        event_repository = EventRepository.from_session(self.session)
        latest_meter_reset = await event_repository.get_latest_meter_reset(
            customer, meter_id
        )
        last_credited_at = datetime.fromisoformat(grant_properties["last_credited_at"])
        # Do it only if the meter wasn't reset during the last cycle
        # It happens because the billing logic trigger a reset after generating the invoice
        if (
            latest_meter_reset is None
            or latest_meter_reset.ingested_at < last_credited_at
        ):
            rollover_units = 0
            if properties["rollover"]:
                meter_repository = MeterRepository.from_session(self.session)
                meter = await meter_repository.get_by_id(meter_id)
                assert meter is not None
                rollover_units = await customer_meter_service.get_rollover_units(
                    self.session, customer, meter
                )

            await event_service.create_event(
                self.session,
                build_system_event(
                    SystemEvent.meter_reset,
                    customer=customer,
                    organization=benefit.organization,
                    metadata={
                        "meter_id": str(meter_id),
                    },
                ),
            )

            if rollover_units > 0:
                await event_service.create_event(
                    self.session,
                    build_system_event(
                        SystemEvent.meter_credited,
                        customer=customer,
                        organization=benefit.organization,
                        metadata={
                            "meter_id": str(meter_id),
                            "units": rollover_units,
                            "rollover": True,
                        },
                    ),
                )

        return await self._create_event(
            customer,
            benefit.organization,
            meter_id=meter_id,
            units=properties["units"],
            rollover=properties["rollover"],
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

        # Skip if not granted before
        meter_id = grant_properties.get("last_credited_meter_id")
        if meter_id is None:
            return grant_properties

        units = -grant_properties.get("last_credited_units", properties["units"])
        return await self._create_event(
            customer,
            benefit.organization,
            meter_id=uuid.UUID(meter_id),
            units=units,
            rollover=properties["rollover"],
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
        self,
        customer: Customer,
        organization: Organization,
        *,
        meter_id: uuid.UUID,
        units: int,
        rollover: bool,
    ) -> BenefitGrantMeterCreditProperties:
        await event_service.create_event(
            self.session,
            build_system_event(
                SystemEvent.meter_credited,
                customer=customer,
                organization=organization,
                metadata={
                    "meter_id": str(meter_id),
                    "units": units,
                    "rollover": rollover,
                },
            ),
        )

        meter_repository = MeterRepository.from_session(self.session)
        meter = await meter_repository.get_by_id(meter_id)
        if meter is not None:
            locker = Locker(self.redis)
            await customer_meter_service.update_customer_meter(
                self.session, locker, customer, meter, activate_meter=True
            )

        return {
            "last_credited_meter_id": str(meter_id),
            "last_credited_units": units,
            "last_credited_at": utc_now().isoformat(),
        }
