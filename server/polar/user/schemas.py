import hashlib
import hmac
import uuid
from enum import StrEnum
from typing import Annotated, Literal

from fastapi import Depends
from pydantic import UUID4, EmailStr, Field, computed_field

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.schemas import Schema, TimestampedSchema, UUID4ToStr
from polar.models.user import IdentityVerificationStatus, OAuthPlatform


class UserBase(Schema):
    email: EmailStr
    avatar_url: str | None
    account_id: UUID4 | None


class OAuthAccountRead(TimestampedSchema):
    platform: OAuthPlatform
    account_id: str
    account_email: str
    account_username: str | None


class UserRead(UserBase, TimestampedSchema):
    id: uuid.UUID
    accepted_terms_of_service: bool
    is_admin: bool
    identity_verified: bool
    identity_verification_status: IdentityVerificationStatus
    oauth_accounts: list[OAuthAccountRead]

    @computed_field
    def email_hash(self) -> str | None:
        if settings.PLAIN_CHAT_SECRET is None:
            return None
        message = hmac.new(
            settings.PLAIN_CHAT_SECRET.encode("utf-8"),
            self.email.encode("utf-8"),
            hashlib.sha256,
        )
        return message.hexdigest()


class UserIdentityVerification(Schema):
    id: str
    client_secret: str


class UserSetAccount(Schema):
    account_id: UUID4


class UserStripePortalSession(Schema):
    url: str


class UserScopes(Schema):
    scopes: list[Scope]


###############################################################################
# USER ATTRIBUTION
###############################################################################


class UserSignupAttribution(Schema):
    intent: (
        Literal[
            "creator",
            "pledge",
            "purchase",
            "subscription",
            "newsletter_subscription",
        ]
        | None
    ) = None

    # Flywheel sources
    order: UUID4ToStr | None = None
    subscription: UUID4ToStr | None = None
    pledge: UUID4ToStr | None = None
    from_storefront: UUID4ToStr | None = None

    # Website source
    path: str | None = None
    host: str | None = None

    # UTM parameters
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None

    campaign: str | None = None


UserSignupAttributionQueryJSON = str | None


async def get_signup_attribution(
    attribution: UserSignupAttributionQueryJSON = None,
) -> UserSignupAttribution | None:
    if attribution:
        return UserSignupAttribution.model_validate_json(attribution)
    return None


UserSignupAttributionQuery = Annotated[
    UserSignupAttribution | None, Depends(get_signup_attribution)
]


class UserDeletionBlockedReason(StrEnum):
    """Reasons why a user account cannot be immediately deleted."""

    HAS_ACTIVE_ORGANIZATIONS = "has_active_organizations"


class BlockingOrganization(Schema):
    """Organization that is blocking user deletion."""

    id: UUID4
    slug: str
    name: str


class UserDeletionResponse(Schema):
    """Response for user deletion request."""

    deleted: bool = Field(
        description="Whether the user account was immediately deleted"
    )
    blocked_reasons: list[UserDeletionBlockedReason] = Field(
        default_factory=list,
        description="Reasons why immediate deletion is blocked",
    )
    blocking_organizations: list[BlockingOrganization] = Field(
        default_factory=list,
        description="Organizations that must be deleted first",
    )
