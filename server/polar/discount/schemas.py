import inspect
from datetime import datetime
from typing import Annotated, Any, Literal, Self

from annotated_types import Ge, Le
from pydantic import (
    UUID4,
    AfterValidator,
    Discriminator,
    Field,
    Tag,
    TypeAdapter,
    model_validator,
)

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    ClassName,
    EmptyStrToNone,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.discount import DiscountDuration, DiscountType
from polar.organization.schemas import OrganizationID
from polar.product.schemas import ProductBase

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


def _code_validator(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.isalnum():
        raise ValueError("Code must contain only alphanumeric characters.")
    if not 3 <= len(value) <= 256:
        raise ValueError("Code must be between 3 and 256 characters long.")
    return value


Code = Annotated[
    EmptyStrToNone,
    AfterValidator(_code_validator),
    Field(
        description=(
            "Code customers can use to apply the discount during checkout. "
            "Must be between 3 and 256 characters long and "
            "contain only alphanumeric characters."
            "If not provided, the discount can only be applied via the API."
        ),
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
        description="Optional timestamp after which the discount is redeemable.",
    ),
]
EndsAt = Annotated[
    datetime | None,
    Field(
        description=(
            "Optional timestamp after which the discount is no longer redeemable."
        ),
    ),
]
MaxRedemptions = Annotated[
    int | None,
    Field(
        description="Optional maximum number of times the discount can be redeemed.",
    ),
    Ge(1),
]
DurationOnceForever = Annotated[
    Literal[DiscountDuration.once, DiscountDuration.forever],
    Field(
        description=(
            "For subscriptions, determines if the discount should be applied "
            "once on the first invoice or forever."
        )
    ),
]
DurationRepeating = Annotated[
    Literal[DiscountDuration.repeating],
    Field(
        description=(
            "For subscriptions, the discount should be applied on every invoice "
            "for a certain number of months, determined by `duration_in_months`."
        )
    ),
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
    Le(999),
]
Amount = Annotated[
    int,
    Field(
        description="Fixed amount to discount from the invoice total.",
        ge=0,
        le=999999999999,
    ),
]
Currency = Annotated[
    str,
    Field(
        pattern="usd",
        description="The currency. Currently, only `usd` is supported.",
    ),
]
BasisPoints = Annotated[
    int,
    Field(
        description=(
            inspect.cleandoc("""
            Discount percentage in basis points.

            A basis point is 1/100th of a percent.
            For example, to create a 25.5% discount, set this to 2550.
            """)
        ),
        ge=1,
        le=10000,
    ),
]
ProductsList = Annotated[
    list[UUID4],
    Field(description="List of product IDs the discount can be applied to."),
]


class DiscountCreateBase(MetadataInputMixin, Schema):
    name: Name
    type: DiscountType = Field(description="Type of the discount.")
    code: Code = None

    starts_at: StartsAt = None
    ends_at: EndsAt = None
    max_redemptions: MaxRedemptions = None

    duration: DiscountDuration

    products: ProductsList | None = None

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


class DiscountOnceForeverDurationCreateBase(Schema):
    duration: DurationOnceForever


class DiscountRepeatDurationCreateBase(Schema):
    duration: DurationRepeating
    duration_in_months: DurationInMonths


class DiscountFixedCreateBase(Schema):
    type: Literal[DiscountType.fixed] = DiscountType.fixed
    amount: Amount
    currency: Currency = "usd"


class DiscountPercentageCreateBase(Schema):
    type: Literal[DiscountType.percentage] = DiscountType.percentage
    basis_points: BasisPoints


class DiscountFixedOnceForeverDurationCreate(
    DiscountCreateBase, DiscountFixedCreateBase, DiscountOnceForeverDurationCreateBase
):
    """Schema to create a fixed amount discount that is applied once or forever."""


class DiscountFixedRepeatDurationCreate(
    DiscountCreateBase, DiscountFixedCreateBase, DiscountRepeatDurationCreateBase
):
    """
    Schema to create a fixed amount discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountPercentageOnceForeverDurationCreate(
    DiscountCreateBase,
    DiscountPercentageCreateBase,
    DiscountOnceForeverDurationCreateBase,
):
    """Schema to create a percentage discount that is applied once or forever."""


class DiscountPercentageRepeatDurationCreate(
    DiscountCreateBase, DiscountPercentageCreateBase, DiscountRepeatDurationCreateBase
):
    """
    Schema to create a percentage discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountUpdate(MetadataInputMixin, Schema):
    """
    Schema to update a discount.
    """

    name: Name | None = None
    code: Code = None

    starts_at: StartsAt = None
    ends_at: EndsAt = None
    max_redemptions: MaxRedemptions = None

    duration: DiscountDuration | None = None
    duration_in_months: DurationInMonths | None = None

    type: DiscountType | None = None
    amount: Amount | None = None
    currency: Currency | None = None
    basis_points: BasisPoints | None = None

    products: ProductsList | None = None

    @model_validator(mode="after")
    def validate_starts_at_ends_at(self) -> Self:
        _starts_at_ends_at_validator(self.starts_at, self.ends_at)
        return self


class DiscountProduct(ProductBase, MetadataOutputMixin):
    """A product that a discount can be applied to."""

    ...


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

    redemptions_count: int = Field(
        description="Number of times the discount has been redeemed."
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
    amount: int = Field(examples=[1000])
    currency: str = Field(examples=["usd"])


class DiscountPercentageBase(Schema):
    type: Literal[DiscountType.percentage] = DiscountType.percentage
    basis_points: int = Field(
        examples=[1000],
        description=(
            "Discount percentage in basis points. "
            "A basis point is 1/100th of a percent. "
            "For example, 1000 basis points equals a 10% discount."
        ),
    )


class DiscountFixedOnceForeverDurationBase(
    DiscountBase, DiscountFixedBase, DiscountOnceForeverDurationBase
): ...


class DiscountFixedRepeatDurationBase(
    DiscountBase, DiscountFixedBase, DiscountRepeatDurationBase
): ...


class DiscountPercentageOnceForeverDurationBase(
    DiscountBase, DiscountPercentageBase, DiscountOnceForeverDurationBase
): ...


class DiscountPercentageRepeatDurationBase(
    DiscountBase, DiscountPercentageBase, DiscountRepeatDurationBase
): ...


class DiscountFullBase(DiscountBase):
    products: list[DiscountProduct]


class DiscountFixedOnceForeverDuration(
    DiscountFullBase, DiscountFixedBase, DiscountOnceForeverDurationBase
):
    """Schema for a fixed amount discount that is applied once or forever."""


class DiscountFixedRepeatDuration(
    DiscountFullBase, DiscountFixedBase, DiscountRepeatDurationBase
):
    """
    Schema for a fixed amount discount that is applied on every invoice
    for a certain number of months.
    """


class DiscountPercentageOnceForeverDuration(
    DiscountFullBase, DiscountPercentageBase, DiscountOnceForeverDurationBase
):
    """Schema for a percentage discount that is applied once or forever."""


class DiscountPercentageRepeatDuration(
    DiscountFullBase, DiscountPercentageBase, DiscountRepeatDurationBase
):
    """
    Schema for a percentage discount that is applied on every invoice
    for a certain number of months.
    """


def get_discriminator_value(v: Any) -> str | None:
    if isinstance(v, dict):
        type = v.get("type")
        duration = v.get("duration")
    else:
        type = getattr(v, "type", None)
        duration = getattr(v, "duration", None)

    if type is None or duration is None:
        return None

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
DiscountMinimal = Annotated[
    Annotated[DiscountFixedOnceForeverDurationBase, Tag("fixed.once_forever")]
    | Annotated[DiscountFixedRepeatDurationBase, Tag("fixed.repeat")]
    | Annotated[
        DiscountPercentageOnceForeverDurationBase, Tag("percentage.once_forever")
    ]
    | Annotated[DiscountPercentageRepeatDurationBase, Tag("percentage.repeat")],
    Discriminator(get_discriminator_value),
]
Discount = Annotated[
    Annotated[DiscountFixedOnceForeverDuration, Tag("fixed.once_forever")]
    | Annotated[DiscountFixedRepeatDuration, Tag("fixed.repeat")]
    | Annotated[DiscountPercentageOnceForeverDuration, Tag("percentage.once_forever")]
    | Annotated[DiscountPercentageRepeatDuration, Tag("percentage.repeat")],
    Discriminator(get_discriminator_value),
    SetSchemaReference("Discount"),
    MergeJSONSchema({"title": "Discount"}),
    ClassName("Discount"),
]
DiscountAdapter: TypeAdapter[Discount] = TypeAdapter(Discount)
