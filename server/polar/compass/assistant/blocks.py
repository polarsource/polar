"""
Generative-UI blocks: the closed set of things the assistant can render.

The model never produces markup. Tools return typed blocks from this
discriminated union, the client maps each block type to a predefined component
in its block registry, and anything outside the union simply cannot be
expressed. Adding a renderable is adding one schema here and one registry entry
on the client.
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Discriminator, Field

from polar.kit.schemas import Schema

from ..schemas import Insight


class BlockType(StrEnum):
    text = "text"
    metric_chart = "metric_chart"
    insight_cards = "insight_cards"
    entity_list = "entity_list"
    data_table = "data_table"
    customer_card = "customer_card"


class TextBlock(Schema):
    """Plain narrated text."""

    type: Literal[BlockType.text] = BlockType.text
    text: str


class MetricChartPoint(Schema):
    timestamp: datetime
    value: float


class MetricChartBlock(Schema):
    """A single metric's series over the requested window."""

    type: Literal[BlockType.metric_chart] = BlockType.metric_chart
    metric: str = Field(description="Metric slug, e.g. `monthly_recurring_revenue`.")
    label: str = Field(description="Human-readable metric name.")
    unit: str = Field(description="Metric unit type, e.g. `currency` or `scalar`.")
    points: list[MetricChartPoint]


class InsightCardsBlock(Schema):
    """Compass insights, rendered with the same card as the feed."""

    type: Literal[BlockType.insight_cards] = BlockType.insight_cards
    insights: list[Insight]


class EntityListItem(Schema):
    title: str
    description: str | None = None
    meta: str | None = Field(
        default=None, description="Right-aligned detail, e.g. an amount or date."
    )


class EntityListBlock(Schema):
    """A few entities as a compact list; use the table for larger sets."""

    type: Literal[BlockType.entity_list] = BlockType.entity_list
    entity: str = Field(description="What the items are, e.g. `orders`.")
    items: list[EntityListItem]
    total_count: int


class ColumnFormat(StrEnum):
    text = "text"
    currency = "currency"
    datetime = "datetime"
    badge = "badge"


class DataTableColumn(Schema):
    key: str
    label: str
    format: ColumnFormat = ColumnFormat.text


class DataTableBlock(Schema):
    """Tabular entities (orders, subscriptions, customers, ...)."""

    type: Literal[BlockType.data_table] = BlockType.data_table
    entity: str = Field(description="What the rows are, e.g. `subscriptions`.")
    columns: list[DataTableColumn]
    rows: list[dict[str, str | int | float | None]]
    total_count: int


class CustomerCardBlock(Schema):
    """A single customer's identity header, above their orders/subscriptions."""

    type: Literal[BlockType.customer_card] = BlockType.customer_card
    email: str
    name: str | None = None
    created_at: datetime


AssistantBlock = Annotated[
    TextBlock
    | MetricChartBlock
    | InsightCardsBlock
    | EntityListBlock
    | DataTableBlock
    | CustomerCardBlock,
    Discriminator("type"),
]
