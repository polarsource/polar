import inspect
from datetime import datetime
from typing import Annotated, Any, Literal, Self

from annotated_types import Ge
from pydantic import Discriminator, Field, Tag, TypeAdapter, model_validator

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import (
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.discount import DiscountDuration, DiscountType
from polar.organization.schemas import OrganizationID

Name = Annotated[
    str,
    Field(
        description=(
            "Name of the discount. "
            "Will be displayed to the customer when the discount is applied."
        ),
        min_length=1,
    ),
]

Code = Annotated[
    str | None,
    Field(
        default=None,
        description=(
            "Code customers can use to apply the discount during checkout. "
            "Must be between 3 and 256 characters long and "
            "contain only alphanumeric characters."
            "If not provided, the discount can only be applied via the API."
        ),
        min_length=3,
        max_length=256,
        pattern=r"^[a-zA-Z0-9]*$",
    ),
]


def _starts_at_ends_at_validator(
    starts_at: datetime | None, ends_at: datetime | None
) -> None:
    if starts_at is not None and ends_at is not None:
        if starts_at >= ends_at:
            raise ValueError("starts_at must be before ends_at")


StartsAt = Annotated[
    datetime | None,
    Field(
        default=None,
        description="Optional timestamp after which the discount is redeemable.",
    ),
]
EndsAt = Annotated[
    datetime | None,
    Field(
        default=None,
        description=(
            "Optional timestamp after which the discount is no longer redeemable."
        ),
    ),
]
MaxRedemptions = Annotated[
    int | None,
    Field(
        default=None,
        description="Optional maximum number of times the discount can be redeemed.",
    ),
    Ge(1),
]
DurationInMonths = Annotated[
    int,
    Field(
        description=inspect.cleandoc("""
        Number of months the discount should be applied.

        For this to work on yearly pricing, you should multiply this by 12.
        For example, to apply the discount for 2 years, set this to 24.
        """)
    ),
    Ge(1),
]


class DiscountCreateBase(MetadataInputMixin, Schema):
    name: Name
    type: DiscountType = Field(description="Type of the discount.")
    code: Code

    starts_at: StartsAt
    ends_at: EndsAt
    max_redemptions: MaxRedemptions

    duration: DiscountDuration

    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the discount. "
            "**Required unless you use an organization token.**"
        ),
    )

    @model_validator(mode="after")
    def validate_starts_at_ends_at(self) -> Self:
        _starts_at_ends_at_validator(self.starts_at, self.ends_at)
        return self


class DiscountCreateOnceForeverDurationBase(Schema):
    duration: Literal[DiscountDuration.once, DiscountDuration.forever] = Field(
        description=(
            "For subscriptions, determines if the discount should be applied "
            "once on the first invoice or forever."
        )
    )


class DiscountCreateRepeatDurationBase(Schema):
    duration: Literal[DiscountDuration.repeating] = Field(
        description=(
            "For subscriptions, the discount should be applied on every invoice "
            "for a certain number of months, determined by `duration_in_months`."
        )
    )
    duration_in_months: DurationInMonths


class DiscountFixedBaseCreate(Schema):
    type: Literal[DiscountType.fixed] = DiscountType.fixed
    amount: int = Field(
        description="Fixed amount to discount from the invoice total.",
        ge=0,
    )
    currency: str = Field(
        Field(
            default="usd",
            pattern="usd",
            description="The currency. Currently, only `usd` is supported.",
        ),
    )


class DiscountPercentageBaseCreate(Schema):
    type: Literal[DiscountType.percentage] = DiscountType.percentage
    basis_points: int = Field(
        description=(
            inspect.cleandoc("""
            Discount percentage in basis points.

            A basis point is 1/100th of a percent.
            For example, to create a 25.5% discount, set this to 2550.
            """)
        ),
        ge=0,
        le=10000,
    )


class DiscountFixedOnceForeverDurationCreate(
    DiscountCreateBase, DiscountFixedBaseCreate, DiscountCreateOnceForeverDurationBase
):
    """Schema to create a fixed amount discount that is applied once or forever."""


class DiscountFixedRepeatDurationCreate(
    DiscountCreateBase, DiscountFixedBaseCreate, DiscountCreateRepeatDurationBase
):
    """
    Schema to create a fixed amount discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountPercentageOnceForeverDurationCreate(
    DiscountCreateBase,
    DiscountPercentageBaseCreate,
    DiscountCreateOnceForeverDurationBase,
):
    """Schema to create a percentage discount that is applied once or forever."""


class DiscountPercentageRepeatDurationCreate(
    DiscountCreateBase, DiscountPercentageBaseCreate, DiscountCreateRepeatDurationBase
):
    """
    Schema to create a percentage discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountUpdate(OptionalMetadataInputMixin, Schema):
    """
    Schema to update a discount.
    """

    name: Name


class DiscountBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    name: str = Field(
        description=(
            "Name of the discount. "
            "Will be displayed to the customer when the discount is applied."
        )
    )
    type: DiscountType
    duration: DiscountDuration
    code: str | None = Field(
        description="Code customers can use to apply the discount during checkout."
    )

    starts_at: datetime | None = Field(
        description="Timestamp after which the discount is redeemable."
    )
    ends_at: datetime | None = Field(
        description="Timestamp after which the discount is no longer redeemable."
    )
    max_redemptions: int | None = Field(
        description="Maximum number of times the discount can be redeemed."
    )

    organization_id: OrganizationID


class DiscountOnceForeverDurationBase(Schema):
    duration: Literal[DiscountDuration.once, DiscountDuration.forever] = Field(
        description=(
            "For subscriptions, determines if the discount should be applied "
            "once on the first invoice or forever."
        )
    )


class DiscountRepeatDurationBase(Schema):
    duration: Literal[DiscountDuration.repeating] = Field(
        description=(
            "For subscriptions, the discount should be applied on every invoice "
            "for a certain number of months, determined by `duration_in_months`."
        )
    )
    duration_in_months: int


class DiscountFixedBase(Schema):
    type: Literal[DiscountType.fixed] = DiscountType.fixed
    amount: int
    currency: str


class DiscountPercentageBase(Schema):
    type: Literal[DiscountType.percentage] = DiscountType.percentage
    basis_points: int


class DiscountFixedOnceForeverDuration(
    DiscountBase, DiscountFixedBase, DiscountOnceForeverDurationBase
):
    """Schema for a fixed amount discount that is applied once or forever."""


class DiscountFixedRepeatDuration(
    DiscountBase, DiscountFixedBase, DiscountRepeatDurationBase
):
    """
    Schema for a fixed amount discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountPercentageOnceForeverDuration(
    DiscountBase, DiscountPercentageBase, DiscountOnceForeverDurationBase
):
    """Schema for a percentage discount that is applied once or forever."""


class DiscountPercentageRepeatDuration(
    DiscountBase, DiscountPercentageBase, DiscountRepeatDurationBase
):
    """
    Schema for a percentage discount that is applied on every invoice
    for a certain number of months.
    """


def get_discriminator_value(v: Any) -> str:
    if isinstance(v, dict):
        type = v["type"]
        duration = v["duration"]
    else:
        type = getattr(v, "type")
        duration = getattr(v, "duration")
    duration_tag = (
        "once_forever"
        if duration in {DiscountDuration.once, DiscountDuration.forever}
        else "repeat"
    )
    return f"{type}.{duration_tag}"


DiscountCreate = Annotated[
    Annotated[DiscountFixedOnceForeverDurationCreate, Tag("fixed.once_forever")]
    | Annotated[DiscountFixedRepeatDurationCreate, Tag("fixed.repeat")]
    | Annotated[
        DiscountPercentageOnceForeverDurationCreate, Tag("percentage.once_forever")
    ]
    | Annotated[DiscountPercentageRepeatDurationCreate, Tag("percentage.repeat")],
    Discriminator(get_discriminator_value),
]
Discount = Annotated[
    Annotated[DiscountFixedOnceForeverDuration, Tag("fixed.once_forever")]
    | Annotated[DiscountFixedRepeatDuration, Tag("fixed.repeat")]
    | Annotated[DiscountPercentageOnceForeverDuration, Tag("percentage.once_forever")]
    | Annotated[DiscountPercentageRepeatDuration, Tag("percentage.repeat")],
    Discriminator(get_discriminator_value),
]
DiscountAdapter: TypeAdapter[Discount] = TypeAdapter(Discount)
