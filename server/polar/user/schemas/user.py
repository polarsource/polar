import uuid
from typing import Annotated, Literal, Self

from fastapi import Depends
from pydantic import UUID4, EmailStr, Field

from polar.auth.scope import Scope
from polar.kit.schemas import Schema, TimestampedSchema, UUID4ToStr
from polar.models.user import OAuthPlatform
from polar.models.user import User as UserModel


# Public API
class User(Schema):
    username: str
    avatar_url: str

    @classmethod
    def from_db(cls, o: UserModel) -> Self:
        return cls(
            username=o.username_or_email,
            # TODO: remove the nullability in the db?
            avatar_url=o.avatar_url or "",
        )


# Private APIs below
class UserBase(Schema):
    username: str = Field(..., max_length=50)
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
    oauth_accounts: list[OAuthAccountRead]


# TODO: remove
class UserCreate(UserBase): ...


# TODO: remove
class UserUpdate(UserBase): ...


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
            "donation",
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
    donation: UUID4ToStr | None = None

    # Website source
    path: str | None = None
    host: str | None = None

    # UTM parameters
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None


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
