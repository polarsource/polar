from datetime import datetime

from pydantic import UUID4, EmailStr, Field

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.agent_setup_run import AgentSetupStage, AgentSetupStageStatus
from polar.organization.schemas import OrganizationSocialLink
from polar.product.schemas import ProductName


class AgentSetupProductDraft(Schema):
    name: ProductName
    description: str | None = Field(None, max_length=500)
    price_amount: int = Field(
        ge=0,
        le=100_000_000,
        description="The price in cents. `0` for a free product.",
    )
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        None, description="`null` for a one-time purchase."
    )


class AgentSetupDrafts(Schema):
    products: list[AgentSetupProductDraft] = Field(default_factory=list, max_length=10)
    product_description: str | None = Field(
        None, max_length=3000, description="What the organization sells."
    )
    website: str | None = Field(None, max_length=255)
    support_email: EmailStr | None = None
    socials: list[OrganizationSocialLink] = Field(default_factory=list, max_length=10)


class AgentSetupStageState(Schema):
    status: AgentSetupStageStatus
    note: str | None = None
    url: str | None = Field(
        None, description="A dashboard page where the user does what is asked."
    )


class AgentSetupRunState(Schema):
    drafts: AgentSetupDrafts | None = Field(
        description=(
            "The drafts as they stand. Once `approved_at` is set these are the "
            "values the user approved."
        )
    )
    approved_at: datetime | None


class AgentSetupRun(IDSchema, TimestampedSchema, AgentSetupRunState):
    organization_id: UUID4
    stages: dict[AgentSetupStage, AgentSetupStageState]


class AgentSetupRunCreated(AgentSetupRun):
    code: str = Field(
        description="The code the agent reports with. It is only returned here."
    )


class AgentSetupReport(Schema):
    code: str = Field(min_length=1, max_length=255)
    stage: AgentSetupStage | None = Field(
        None, description="Leave out to only read the state of the run."
    )
    status: AgentSetupStageStatus = AgentSetupStageStatus.done
    note: str | None = Field(None, max_length=200)
    url: str | None = Field(
        None,
        max_length=4000,
        description=(
            "A page of the Polar dashboard the user should open for this stage, "
            "e.g. to approve an access token. Other origins are rejected."
        ),
    )
    drafts: AgentSetupDrafts | None = Field(
        None,
        description=(
            "Merged into the drafts already reported, field by field. Ignored "
            "once the user has approved the drafts."
        ),
    )
