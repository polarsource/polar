from datetime import datetime

from pydantic import UUID4, Field

from polar.customer_portal.service.customer_session import (
    CustomerSessionCodeInvalidOrExpired,
)
from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


class CustomerSessionCodeRequest(Schema):
    email: EmailStrDNS
    organization_id: UUID4


class CustomerSessionCodeAuthenticateRequest(Schema):
    code: str


class CustomerSummary(Schema):
    """Summary of a customer for selection."""

    id: UUID4
    name: str | None
    email: str


class CustomerSessionCodeAuthenticateResponse(Schema):
    """Response from authenticating with a customer session code."""

    # Success case - token is set when authentication completes
    token: str | None = Field(
        default=None,
        description="The session token. Set when authentication is complete.",
    )
    customer_id: UUID4 | None = Field(
        default=None,
        description="The ID of the customer the session is for.",
    )
    member_id: UUID4 | None = Field(
        default=None,
        description="The ID of the member the session is for.",
    )

    # Customer selection case - when member belongs to multiple customers
    requires_customer_selection: bool = Field(
        default=False,
        description="Whether the user needs to select which customer to log in as.",
    )
    selection_token: str | None = Field(
        default=None,
        description=(
            "Temporary token for customer selection. "
            "Use with the /select endpoint to complete authentication."
        ),
    )
    email: str | None = Field(
        default=None,
        description="The member's email. Pass this to the /select endpoint.",
    )
    organization_id: UUID4 | None = Field(
        default=None,
        description="The organization ID. Pass this to the /select endpoint.",
    )
    available_customers: list[CustomerSummary] | None = Field(
        default=None,
        description="List of customers the member can log in as.",
    )


class CustomerSessionSelectRequest(Schema):
    """Request to select a customer after authentication."""

    selection_token: str = Field(
        description="The selection token from the authenticate response."
    )
    customer_id: UUID4 = Field(
        description="The ID of the customer to log in as."
    )
    email: str = Field(
        description="The email address from the authenticate response."
    )
    organization_id: UUID4 = Field(
        description="The organization ID from the authenticate response."
    )


class CustomerSessionSelectResponse(Schema):
    """Response from selecting a customer."""

    token: str = Field(description="The session token.")
    customer_id: UUID4 = Field(description="The ID of the selected customer.")
    member_id: UUID4 = Field(description="The ID of the member.")


class CustomerSessionSwitchRequest(Schema):
    """Request to switch to a different customer within the same session."""

    customer_id: UUID4 = Field(
        description="The ID of the customer to switch to."
    )


class CustomerSessionSwitchResponse(Schema):
    """Response from switching customers."""

    token: str = Field(description="The new session token.")
    customer_id: UUID4 = Field(description="The ID of the new customer.")
    member_id: UUID4 = Field(description="The ID of the member.")


class CustomerSessionCustomersResponse(Schema):
    """Response listing available customers for the current member."""

    current_customer_id: UUID4 = Field(
        description="The ID of the currently selected customer."
    )
    customers: list[CustomerSummary] = Field(
        description="List of customers the member can switch to."
    )


CustomerSessionCodeInvalidOrExpiredResponse = {
    "description": "Invalid or expired verification code.",
    "model": CustomerSessionCodeInvalidOrExpired.schema(),
}


class CustomerCustomerSession(Schema):
    expires_at: datetime
    return_url: str | None
    member_id: UUID4 | None = Field(
        default=None,
        description="The ID of the member this session is for.",
    )
