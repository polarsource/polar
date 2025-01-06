from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class CustomerCardKey(StrEnum):
    organization = "organization"
    customer = "customer"
    latest_order = "latest_order"


class CustomerCardCustomer(BaseModel):
    id: str
    email: str
    externalId: str | None


class CustomerCardThread(BaseModel):
    id: str
    externalId: str | None


class CustomerCardsRequest(BaseModel):
    cardKeys: list[CustomerCardKey]
    customer: CustomerCardCustomer
    thread: CustomerCardThread | None


class CustomerCard(BaseModel):
    key: CustomerCardKey
    timeToLiveSeconds: int
    components: list[dict[str, Any]] | None


class CustomerCardsResponse(BaseModel):
    cards: list[CustomerCard]
