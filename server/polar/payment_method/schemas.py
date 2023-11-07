from typing import Literal, Self

import stripe as stripe_lib

from polar.kit.schemas import Schema


# Public API
class PaymentMethod(Schema):
    stripe_payment_method_id: str
    type: Literal["card", None]
    brand: str | None
    last4: str
    exp_month: int
    exp_year: int

    @classmethod
    def from_stripe(cls, o: stripe_lib.PaymentMethod) -> Self:
        return cls(
            stripe_payment_method_id=o.id,
            type="card" if o.type == "card" else None,
            brand=o.card.brand,
            last4=o.card.last4,
            exp_month=o.card.exp_month,
            exp_year=o.card.exp_year,
        )
