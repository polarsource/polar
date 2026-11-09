from datetime import date
from decimal import Decimal

from pydantic import UUID4, AwareDatetime, Field
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.kit.schemas import Schema
from polar.kit.time_queries import TimeInterval
from polar.kit.versioning import QuerySchema
from polar.organization.schemas import OrganizationID


class FeatureBreakdownParams(QuerySchema):
    organization_id: OrganizationID = Field(description="The organization ID.")
    start_date: date = Field(description="Start date.")
    end_date: date = Field(description="End date.")
    timezone: TimeZoneName = Field(
        default=TimeZoneName("UTC"),
        description="Timezone to use for the dates. Default is UTC.",
    )
    interval: TimeInterval = Field(
        default=TimeInterval.day, description="Interval of the periods."
    )


class FeatureCustomer(Schema):
    customer_id: UUID4 | None = Field(description="Polar customer ID.")
    external_customer_id: str | None = Field(description="External customer ID.")
    name: str | None = Field(description="Customer name.")
    email: str | None = Field(description="Customer email.")
    occurrences: int = Field(description="Times the customer used the feature.")
    cost: Decimal = Field(description="Cost to serve the customer, in cents.")
    input_tokens: int = Field(
        description="LLM input tokens spent serving the customer."
    )
    output_tokens: int = Field(
        description="LLM output tokens spent serving the customer."
    )
    revenue: Decimal = Field(
        description="The customer's revenue credited to the feature, in cents."
    )


class Feature(Schema):
    name: str = Field(description="The name of the root event type.")
    label: str = Field(description="The label of the event type.")
    event_type_id: UUID4 | None = Field(description="The ID of the event type.")
    occurrences: int = Field(description="Times the feature was used.")
    customers: int = Field(description="Distinct customers who used the feature.")
    paying_customers: int = Field(
        description="Customers who used the feature and paid in the period."
    )
    cost: Decimal = Field(description="Cost to serve the feature, in cents.")
    input_tokens: int = Field(description="LLM input tokens spent serving the feature.")
    output_tokens: int = Field(
        description="LLM output tokens spent serving the feature."
    )
    revenue: Decimal = Field(
        description=(
            "Revenue credited to the feature, in cents. Each customer's revenue "
            "is split across features by their share of usage."
        )
    )
    top_customers: list[FeatureCustomer] = Field(
        description="The customers who cost the most to serve with this feature."
    )


class FeatureDetailCustomer(FeatureCustomer):
    plan: str | None = Field(
        description="Name of the product the customer paid most for, if any."
    )
    total_revenue: int = Field(
        description="The customer's net revenue across all features, in cents."
    )


class FeaturePlan(Schema):
    name: str | None = Field(description="Product name, or null for free customers.")
    customers: int = Field(description="Customers on the plan who used the feature.")
    occurrences: int = Field(description="Times they used the feature.")
    cost: Decimal = Field(description="Cost to serve them, in cents.")
    revenue: Decimal = Field(description="Their revenue credited to the feature.")


class FeaturePeriod(Schema):
    timestamp: AwareDatetime = Field(description="Start of the period.")
    occurrences: int = Field(description="Times the feature was used.")
    cost: Decimal = Field(description="Cost to serve, in cents.")
    revenue: Decimal = Field(description="Revenue credited to the feature, in cents.")
    input_tokens: int = Field(description="LLM input tokens.")
    output_tokens: int = Field(description="LLM output tokens.")


class FeatureSummary(Feature):
    periods: list[FeaturePeriod] = Field(description="Usage over time.")


class FeatureBreakdown(Schema):
    currency: str = Field(description="Currency of the revenue and cost amounts.")
    revenue: int = Field(description="Net revenue in the period, in cents.")
    unattributed_revenue: Decimal = Field(
        description="Revenue from customers who used no feature in the period."
    )
    cost: Decimal = Field(description="Cost to serve all features, in cents.")
    features: list[FeatureSummary] = Field(
        description="Features, by revenue descending."
    )


class FeatureStep(Schema):
    name: str = Field(description="Name of the child event.")
    label: str = Field(description="Label of the child event type.")
    occurrences: int = Field(description="Times the step ran.")
    cost: Decimal = Field(description="Cost of the step, in cents.")
    input_tokens: int = Field(description="LLM input tokens spent by the step.")
    output_tokens: int = Field(description="LLM output tokens spent by the step.")


class FeatureModel(Schema):
    vendor: str = Field(description="LLM vendor.")
    model: str = Field(description="LLM model.")
    calls: int = Field(description="Events that called the model.")
    cost: Decimal = Field(description="Cost of those events, in cents.")
    input_tokens: int = Field(description="LLM input tokens.")
    output_tokens: int = Field(description="LLM output tokens.")


class FeatureDetail(Schema):
    currency: str = Field(description="Currency of the revenue and cost amounts.")
    feature: Feature
    customers: list[FeatureDetailCustomer] = Field(
        description="Every customer who used the feature."
    )
    plans: list[FeaturePlan] = Field(description="Usage by plan.")
    periods: list[FeaturePeriod] = Field(description="Usage over time.")
    steps: list[FeatureStep] = Field(
        description="The steps below the feature's events, by cost."
    )
    models: list[FeatureModel] = Field(
        description="The LLM models the feature's events called, by cost."
    )


class FeatureEventCustomer(Schema):
    customer_id: UUID4 | None = Field(description="Polar customer ID.")
    external_customer_id: str | None = Field(description="External customer ID.")
    customer_name: str | None = Field(description="Customer name or email.")


class FeatureAnomaly(FeatureEventCustomer):
    id: UUID4 = Field(description="ID of the root event.")
    timestamp: AwareDatetime = Field(description="When the feature was used.")
    cost: Decimal = Field(description="Cost of this use, in cents.")
    multiple: Decimal = Field(description="Cost as a multiple of the median use.")


class FeatureHighlights(Schema):
    median_cost: Decimal = Field(description="Median cost of one use, in cents.")
    anomalies: list[FeatureAnomaly] = Field(
        description="Uses that cost far more than the median, costliest first."
    )
