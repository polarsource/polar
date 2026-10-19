from typing import Literal

from pydantic import Field

from polar.declarative_config.schemas import ConfigResource
from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import Schema


class SimulationCounts(Schema):
    more: int = Field(description="Subscribers who would pay more.")
    less: int = Field(description="Subscribers who would pay less.")
    same: int = Field(description="Subscribers who would pay the same.")
    no_history: int = Field(
        description="Subscribers with no closed period yet, such as trials. "
        "Counted, not simulated."
    )
    not_simulated: int = Field(
        description="Subscribers left out because none of their bill could be repriced."
    )


class SimulationComponent(Schema):
    label: str = Field(description="What this part of the bill is.")
    kind: Literal["fee", "usage"] = Field(description="Fixed fee or usage charge.")
    meter_external_id: str | None = Field(
        default=None, description="The meter of a usage component."
    )
    baseline: int = Field(description="Monthly amount today, in minor units.")
    proposed: int = Field(description="Monthly amount on the config, in minor units.")


class SimulationCohort(Schema):
    product_external_id: str = Field(description="The product's `external_id`.")
    price_label: str = Field(description="The price the cohort pays today.")
    archived: bool = Field(description="Whether the cohort pays an archived price.")
    partial: bool = Field(
        description="Whether part of the bill wasn't simulated. The amounts then "
        "cover only the simulated components."
    )
    recurring_interval: SubscriptionRecurringInterval
    recurring_interval_count: int
    subscribers: int = Field(description="Number of simulated subscribers.")
    baseline_monthly: int = Field(
        description="What the cohort pays per month today, in minor units."
    )
    proposed_monthly: int = Field(
        description="What the cohort would pay per month on the config, in minor units."
    )
    components: list[SimulationComponent]


class SimulationNotSimulated(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    external_id: str = Field(description="The resource's `external_id`.")
    reason: str = Field(description="Why the simulation can't reprice it.")
    subscribers: int = Field(description="Number of subscribers it affects.")


class SimulationResult(Schema):
    monthly_delta: int = Field(
        description="Proposed minus baseline, per month, summed over simulated "
        "subscribers, in minor units."
    )
    currency: str
    counts: SimulationCounts
    cohorts: list[SimulationCohort]
    not_simulated: list[SimulationNotSimulated]
