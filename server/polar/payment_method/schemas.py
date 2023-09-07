from typing import Literal, Self
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models.payment_method import PaymentMethod as PaymentMethodModel


# Public API
class PaymentMethod(Schema):
    id: UUID
    stripe_payment_method_id: str
    type: Literal["card", None]
    brand: Literal["visa", "mastercard", None]
    last4: str

    @classmethod
    def from_db(cls, o: PaymentMethodModel) -> Self:
        brand: Literal["visa", "mastercard", None] = None
        if o.brand == "visa":
            brand = "visa"
        elif o.brand == "mastercard":
            brand = "mastercard"

        return cls(
            id=o.id,
            stripe_payment_method_id=o.stripe_payment_method_id,
            type="card" if o.type == "card" else None,
            brand=brand,
            last4=o.last4,
        )
