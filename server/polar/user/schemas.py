import uuid
from typing import Annotated, Literal

from fastapi import Depends
from pydantic import UUID4, EmailStr, Field

from polar.auth.scope import Scope
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
    totp_enabled: bool


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
# TWO-FACTOR AUTHENTICATION
###############################################################################


class TOTPSetupRequest(Schema):
    pass


class TOTPSetupResponse(Schema):
    secret: str = Field(..., description="TOTP secret (base32 encoded)")
    qr_code: str = Field(..., description="QR code as base64 encoded PNG")
    backup_codes: list[str] = Field(..., description="Backup codes for recovery")


class TOTPEnableRequest(Schema):
    verification_code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class TOTPDisableRequest(Schema):
    verification_code: str = Field(..., min_length=6, max_length=8, description="6-digit TOTP code or backup code")


class TOTPVerificationRequest(Schema):
    code: str = Field(..., min_length=6, max_length=8, description="6-digit TOTP code or backup code")


class TOTPStatusResponse(Schema):
    enabled: bool = Field(..., description="Whether TOTP is enabled")
    backup_codes_remaining: int = Field(default=0, description="Number of unused backup codes")


class TOTPBackupCodesResponse(Schema):
    backup_codes: list[str] = Field(..., description="New backup codes for recovery")


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
