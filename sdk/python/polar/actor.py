import typing

from polar.metering.events import ContextualEventInput
from polar.metering.meter import CustomerMeter

if typing.TYPE_CHECKING:
    from polar.base import PolarAsyncBase


class Actor:
    """Customer-bound helper returned by PolarAsync.actor()."""

    def __init__(
        self,
        polar: "PolarAsyncBase",
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> None:
        """Bind a helper to a validated actor identity.

        Args:
            polar: Polar client.
            customer_id: Polar customer ID; mutually exclusive with external_customer_id.
            member_id: Polar member ID, paired with customer_id.
            external_customer_id: Customer ID in your application.
            external_member_id: Member ID paired with external_customer_id.
        """
        self.polar = polar
        self.customer_id = customer_id
        self.member_id = member_id
        self.external_customer_id = external_customer_id
        self.external_member_id = external_member_id

    async def track(self, **event: typing.Unpack[ContextualEventInput]) -> None:
        """Track an event with this actor's identifiers attached.

        Args:
            **event: Event name and optional metadata, timestamp, or external ID.
        """
        if self.customer_id is not None:
            await self.polar.track(
                customer_id=self.customer_id, member_id=self.member_id, **event
            )
        else:
            assert self.external_customer_id is not None
            await self.polar.track(
                external_customer_id=self.external_customer_id,
                external_member_id=self.external_member_id,
                **event,
            )

    async def meter(self, meter_id: str) -> CustomerMeter | None:
        """Read this customer's meter.

        Args:
            meter_id: Polar meter ID.

        Returns:
            Consumption, credits, and balance, or None if no meter is found.
        """
        if self.customer_id is not None:
            return await self.polar.meter(
                meter_id=meter_id, customer_id=self.customer_id
            )
        assert self.external_customer_id is not None
        return await self.polar.meter(
            meter_id=meter_id, external_customer_id=self.external_customer_id
        )


def validate_actor(
    customer_id: str | None,
    member_id: str | None,
    external_customer_id: str | None,
    external_member_id: str | None,
) -> None:
    if (customer_id is None) == (external_customer_id is None):
        raise ValueError("Provide exactly one customer_id or external_customer_id")
    if member_id is not None and customer_id is None:
        raise ValueError("member_id requires customer_id")
    if external_member_id is not None and external_customer_id is None:
        raise ValueError("external_member_id requires external_customer_id")
