from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, TypeAdapter

from polar.kit.schemas import Schema

type SearchResultType = Literal["product", "customer", "order", "subscription"]


class SearchResultProduct(Schema):
    type: Literal["product"] = "product"
    id: UUID4
    name: str
    description: str | None = None


class SearchResultCustomer(Schema):
    type: Literal["customer"] = "customer"
    id: UUID4
    name: str | None
    email: str


class SearchResultOrder(Schema):
    type: Literal["order"] = "order"
    id: UUID4
    customer_name: str | None
    customer_email: str
    product_name: str
    amount: int


class SearchResultSubscription(Schema):
    type: Literal["subscription"] = "subscription"
    id: UUID4
    customer_name: str | None
    customer_email: str
    product_name: str
    status: str
    amount: int


SearchResult = Annotated[
    SearchResultProduct
    | SearchResultCustomer
    | SearchResultOrder
    | SearchResultSubscription,
    Discriminator("type"),
]

SearchResultTypeAdapter: TypeAdapter[SearchResult] = TypeAdapter(SearchResult)


class SearchResults(Schema):
    results: list[SearchResult]
