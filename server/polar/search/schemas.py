from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field, TypeAdapter

from polar.kit.schemas import Schema
from polar.kit.versioning import QuerySchema

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
    email: str | None


class SearchResultOrder(Schema):
    type: Literal["order"] = "order"
    id: UUID4
    customer_name: str | None
    customer_email: str | None
    product_name: str
    amount: int
    currency: str


class SearchResultSubscription(Schema):
    type: Literal["subscription"] = "subscription"
    id: UUID4
    customer_name: str | None
    customer_email: str | None
    product_name: str
    status: str
    amount: int
    currency: str


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


class SearchSearchParams(QuerySchema):
    organization_id: UUID4 = Field(..., description="Organization ID to search within")
    query: str = Field(..., max_length=200, description="Search query string")
    limit: int = Field(20, ge=1, le=50, description="Maximum number of results")
