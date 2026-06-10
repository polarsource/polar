from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.exceptions import ResourceNotFound
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.organization.schemas import OrganizationID

LLMProviderConfigID = Annotated[
    UUID4, Path(description="The LLM provider config ID.")
]

LLMProviderConfigNotFound = {
    "description": "LLM provider config not found.",
    "model": ResourceNotFound.schema(),
}


class LLMProviderConfigCreate(Schema):
    """Schema for creating an LLM provider configuration."""

    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization. "
            "**Required unless you use an organization token.**"
        ),
    )
    provider: str = Field(
        ...,
        max_length=64,
        description="LLM provider identifier, e.g. openai, anthropic, google.",
    )
    model_name: str = Field(
        ...,
        max_length=256,
        description="Model identifier, e.g. gpt-4o, claude-sonnet-4-20250514.",
    )
    display_name: str | None = Field(
        default=None,
        max_length=256,
        description="Optional display name shown to customers.",
    )
    api_key: str = Field(
        ...,
        description="The provider API key. Will be encrypted before storage.",
    )


class LLMProviderConfigUpdate(Schema):
    """Schema for updating an LLM provider configuration."""

    display_name: str | None = None
    api_key: str | None = Field(
        default=None,
        description="New provider API key. Will be encrypted before storage.",
    )
    is_enabled: bool | None = None


class LLMProviderConfig(TimestampedSchema, IDSchema):
    """An LLM provider configuration for proxying requests."""

    organization_id: UUID4 = Field(description="The ID of the organization.")
    provider: str = Field(description="LLM provider identifier.")
    model_name: str = Field(description="Model identifier.")
    display_name: str | None = Field(description="Optional display name.")
    is_enabled: bool = Field(description="Whether this config is active.")
