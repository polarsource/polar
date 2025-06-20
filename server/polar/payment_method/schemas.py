from typing import Literal

from pydantic import UUID4, AliasPath, Field, TypeAdapter

from polar.enums import PaymentProcessor
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class PaymentMethodBase(TimestampedSchema, IDSchema):
    processor: PaymentProcessor
    customer_id: UUID4


class PaymentMethodGeneric(PaymentMethodBase):
    type: str


class PaymentMethodCardMetadata(Schema):
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    wallet: str | None = Field(
        default=None, validation_alias=AliasPath("wallet", "type")
    )


class PaymentMethodCard(PaymentMethodBase):
    type: Literal["card"]
    method_metadata: PaymentMethodCardMetadata


PaymentMethod = PaymentMethodCard | PaymentMethodGeneric
PaymentMethodTypeAdapter: TypeAdapter[PaymentMethod] = TypeAdapter(PaymentMethod)
