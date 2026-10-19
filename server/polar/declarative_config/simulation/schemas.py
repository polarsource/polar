from datetime import datetime

from pydantic import Field

from polar.declarative_config.schemas import ConfigResource
from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import Schema


class SimulationCounts(Schema):
    more: int = Field(description="Subscribers who would pay more.")
    less: int = Field(description="Subscribers who would pay less.")
    same: int = Field(description="Subscribers who would pay the same.")
    no_history: int = Field(
        description="Active subscribers with nothing billed in the window, such as "
        "trials. Counted, not simulated."
    )
    not_simulated: int = Field(
        description="Subscribers billed in the window, left out because none of "
        "their bill could be repriced."
    )


class SimulationBreakdownItem(Schema):
    product_external_id: str = Field(description="The product's `external_id`.")
    price_label: str = Field(description="The price these subscribers were billed on.")
    archived: bool = Field(description="Whether that price is archived.")
    partial: bool = Field(
        description="Whether part of the bill wasn't simulated. The amounts then "
        "cover only the simulated items."
    )
    recurring_interval: SubscriptionRecurringInterval
    recurring_interval_count: int
    subscribers: int = Field(
        description="Number of subscriptions billed on this price in the window."
    )
    baseline: int = Field(
        description="What these subscribers were billed in the window, in minor units."
    )
    proposed: int = Field(
        description="What they would have been billed on the config, in minor units."
    )


class SimulationNotSimulated(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    external_id: str = Field(description="The resource's `external_id`.")
    reason: str = Field(description="Why the simulation can't reprice it.")
    subscribers: int = Field(description="Number of subscribers it affects.")


class SimulationWindow(Schema):
    since: datetime
    until: datetime
    months: float = Field(description="Length of the window in calendar months.")


class SimulationResult(Schema):
    window: SimulationWindow = Field(description="The replayed time range.")
    currency: str
    baseline: int = Field(
        description="Billed in the window by simulated items, in minor units."
    )
    proposed: int = Field(
        description="What the same items bill on the config, in minor units."
    )
    monthly_delta: int = Field(
        description="Proposed minus baseline, per month of the window, in minor units."
    )
    counts: SimulationCounts
    breakdown: list[SimulationBreakdownItem]
    not_simulated: list[SimulationNotSimulated]
