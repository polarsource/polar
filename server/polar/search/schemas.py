from typing import Literal

from pydantic import UUID4

from polar.kit.schemas import Schema


class SearchResultProduct(Schema):
    id: UUID4
    name: str
    type: Literal["product"] = "product"
    description: str | None = None


class SearchResultCustomer(Schema):
    id: UUID4
    name: str | None
    email: str
    type: Literal["customer"] = "customer"


class SearchResultOrder(Schema):
    id: UUID4
    customer_name: str | None
    customer_email: str
    product_name: str
    amount: int
    type: Literal["order"] = "order"


class SearchResultSubscription(Schema):
    id: UUID4
    customer_name: str | None
    customer_email: str
    product_name: str
    status: str
    amount: int
    type: Literal["subscription"] = "subscription"


SearchResult = (
    SearchResultProduct
    | SearchResultCustomer
    | SearchResultOrder
    | SearchResultSubscription
)


class SearchResults(Schema):
    results: list[SearchResult]
