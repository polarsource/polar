from datetime import datetime
from enum import StrEnum

from pydantic import Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class PricingModelType(StrEnum):
    usage = "Usage"
    seat = "Seat"
    tiered = "Tiered"
    hybrid = "Hybrid"
    flat = "Flat"


class ChangeDirection(StrEnum):
    up = "up"
    down = "down"
    new = "new"


# --- LLM extraction output ---------------------------------------------------


class ExtractedProduct(Schema):
    name: str = Field(description="Name of the plan or product, e.g. 'Pro' or 'API'.")
    model: PricingModelType = Field(
        description="The pricing model that best describes this product."
    )
    anchor: str = Field(
        description=(
            "One short, representative price a human would recognise, e.g. "
            "'$20 / user / mo', '$2.50 / M tokens', '$25 / mo Pro', or 'Custom'."
        )
    )


class ExtractedPricing(Schema):
    products: list[ExtractedProduct] = Field(
        description="Every distinct paid product or plan found on the page."
    )
    confidence: float = Field(
        ge=0,
        le=1,
        description="0-1 confidence that the extraction is accurate and complete.",
    )


# --- Read schemas (for the directory API) ------------------------------------


class PricingSnapshotSchema(IDSchema):
    captured_at: datetime
    model: str
    anchor: str
    direction: ChangeDirection


class PricingProductSummary(IDSchema):
    name: str
    current_model: str
    current_anchor: str
    last_direction: ChangeDirection
    last_change_at: datetime


class PricingProductSchema(PricingProductSummary):
    snapshots: list[PricingSnapshotSchema]


class PricingCompanySummary(IDSchema, TimestampedSchema):
    slug: str
    name: str
    category: str
    summary: str | None
    products: list[PricingProductSummary]


class PricingCompanySchema(IDSchema, TimestampedSchema):
    slug: str
    name: str
    category: str
    summary: str | None
    products: list[PricingProductSchema]


class PricingChangeSchema(Schema):
    date: datetime
    company: str
    company_slug: str
    product: str
    model: str
    anchor: str
    direction: ChangeDirection
