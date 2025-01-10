from typing import Annotated

from pydantic import UUID4

from polar.kit.schemas import (
    MergeJSONSchema,
    Schema,
    SelectorWidget,
)
from polar.models.refund import (
    RefundReason,
    RefundStatus,
)

RefundID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The refund ID."}),
    SelectorWidget("/v1/refunds", "Refund", "name"),
]


class RefundBase(Schema):
    status: RefundStatus
    reason: RefundReason
    amount: int
    tax_amount: int
    currency: str


class Refund(RefundBase): ...


class RefundUpdate(RefundBase): ...


class RefundCreate(RefundBase):
    id: RefundID
