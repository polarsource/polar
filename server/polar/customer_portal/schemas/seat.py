from uuid import UUID

from pydantic import Field

from polar.customer_seat.schemas import SeatAssign


class CustomerSeatAssign(SeatAssign):
    checkout_id: UUID | None = Field(
        None,
        description=(
            "Checkout ID. Resolves to the subscription or order produced by "
            "the checkout."
        ),
    )

    def _seat_source_ids(self) -> list[UUID | None]:
        return [self.subscription_id, self.order_id, self.checkout_id]

    def _seat_source_error_message(self) -> str:
        return (
            "Exactly one of subscription_id, order_id, or checkout_id must be provided"
        )
