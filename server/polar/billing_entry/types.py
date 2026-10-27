from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal
from uuid import UUID


@dataclass(frozen=True)
class PendingByPrice:
    product_price_id: UUID
    kind: Literal["price"] = "price"


@dataclass(frozen=True)
class PendingByMeter:
    meter_id: UUID
    kind: Literal["meter"] = "meter"


type BillingEntrySelector = Sequence[UUID] | PendingByPrice | PendingByMeter
