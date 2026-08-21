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


class PaymentMethodKrCardMetadata(Schema):
    brand: str | None
    last4: str | None


class PaymentMethodKrCard(PaymentMethodBase):
    type: Literal["kr_card"]
    method_metadata: PaymentMethodKrCardMetadata


PaymentMethod = PaymentMethodCard | PaymentMethodKrCard | PaymentMethodGeneric
PaymentMethodTypeAdapter: TypeAdapter[PaymentMethod] = TypeAdapter(PaymentMethod)
