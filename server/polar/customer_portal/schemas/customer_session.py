from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import IDSchema, Schema


class CustomerSessionCodeAuthenticateResponse(Schema):
    token: str


class CustomerSessionAuthenticationStart(Schema):
    organization_id: UUID4


class CustomerSessionEmailOTPRequest(Schema):
    email: EmailStrDNS
    customer_id: UUID4 | None = Field(
        default=None,
        description=(
            "Optional customer ID for disambiguation when multiple customers "
            "share the same email."
        ),
    )
    turnstile_token: str = Field(alias="cf-turnstile-response")


class CustomerSessionEmailOTPVerify(Schema):
    code: str


class CustomerCustomerSession(Schema):
    expires_at: datetime
    return_url: str | None


class CustomerSelectionOption(IDSchema):
    """Minimal customer information for disambiguation selection."""

    name: str | None = Field(description="The customer's name, if available.")


class CustomerSelectionRequiredResponse(Schema):
    """Response when multiple customers match the email."""

    error: str = "customer_selection_required"
    detail: str = "Multiple customers found for this email. Please select one."
    customers: list[CustomerSelectionOption] = Field(
        description="List of customers to choose from."
    )


class PortalAuthenticatedUser(Schema):
    """Information about the authenticated portal user."""

    type: str = Field(description="Type of authenticated user: 'customer' or 'member'")
    name: str | None = Field(description="User's name, if available.")
    email: str = Field(description="User's email address.")
    customer_id: UUID4 = Field(description="Associated customer ID.")
    member_id: UUID4 | None = Field(
        default=None,
        description="Member ID. Only set for members.",
    )
    role: str | None = Field(
        default=None,
        description="Member role (owner, billing_manager, member). Only set for members.",
    )
