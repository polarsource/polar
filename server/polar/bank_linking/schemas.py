"""Schemas for bank linking API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BankLinkingSessionCreate(BaseModel):
    """Request to create a bank linking session."""

    account_id: UUID = Field(description="The Spaire account ID to link the bank to")
    return_url: str = Field(description="URL to redirect after completion")


class BankLinkingSession(BaseModel):
    """Response with bank linking session details."""

    client_secret: str = Field(description="Client secret for Stripe.js")
    session_id: str = Field(description="Stripe Financial Connections session ID")
    publishable_key: str = Field(description="Stripe publishable key")


class BankLinkingComplete(BaseModel):
    """Request to complete bank linking after user connects their bank."""

    account_id: UUID = Field(description="The Spaire account ID")
    financial_connections_account_id: str = Field(
        description="Stripe Financial Connections account ID from the modal"
    )


class BankAccountInfo(BaseModel):
    """Information about a linked bank account."""

    id: UUID = Field(description="Bank details ID")
    account_id: UUID = Field(description="Associated Spaire account ID")
    bank_name: str | None = Field(description="Name of the bank")
    account_type: str = Field(description="checking or savings")
    account_number_last4: str = Field(description="Last 4 digits of account number")
    routing_number_last4: str = Field(description="Last 4 digits of routing number")
    verified_at: datetime = Field(description="When the account was verified")
    is_rtp_eligible: bool = Field(
        description="Whether this bank supports Real-Time Payments (instant)"
    )
    mercury_recipient_id: str | None = Field(
        description="Mercury recipient ID if created"
    )


class BankLinkingStatus(BaseModel):
    """Status of bank linking for an account."""

    has_linked_bank: bool = Field(description="Whether a bank is linked")
    bank_account: BankAccountInfo | None = Field(
        description="Bank account info if linked"
    )
    is_rtp_eligible: bool = Field(
        description="Whether instant payouts are available"
    )
    is_mercury_ready: bool = Field(
        description="Whether Mercury recipient is created and ready for payouts"
    )


class BankLinkingError(BaseModel):
    """Error response for bank linking operations."""

    error: str = Field(description="Error code")
    message: str = Field(description="Human-readable error message")
    details: dict | None = Field(default=None, description="Additional error details")
