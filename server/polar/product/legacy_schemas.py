import builtins
from typing import Annotated, Literal

from pydantic import MISSING, BeforeValidator, Discriminator, Field, Tag

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import SetSchemaReference
from polar.kit.versioning import Omissible
from polar.models.product_price import ProductPriceAmountType
from polar.models.product_price import (
    ProductPriceSeatUnit as ProductPriceSeatUnitModel,
)

from . import schemas
from .schemas import (
    PRICE_CREATE_LIST_SCHEMA,
    PRODUCT_CREATE_PRICES_DESCRIPTION,
    PRODUCT_UPDATE_PRICES_DESCRIPTION,
    ExistingProductPrice,
    ProductPriceCreateBase,
    ProductPriceCustomCreate,
    ProductPriceFixedCreate,
    ProductPriceMeteredTiersCreate,
    ProductPriceMeteredUnitCreate,
    ProductPriceSeatTiers,
    ProductPriceUnitBasedCreate,
    _coerce_legacy_free_price,
    _product_create_discriminator,
)


class ProductPriceSeatBasedCreate(ProductPriceCreateBase):
    """
    Schema to create a seat-based price with volume-based tiers.
    """

    amount_type: Literal[ProductPriceAmountType.seat_based]
    seat_tiers: ProductPriceSeatTiers = Field(
        description="Tiered pricing based on seat quantity"
    )

    def get_model_class(self) -> builtins.type[ProductPriceSeatUnitModel]:
        return ProductPriceSeatUnitModel


ProductPriceCreate = Annotated[
    Annotated[
        ProductPriceFixedCreate
        | ProductPriceCustomCreate
        | ProductPriceSeatBasedCreate
        | ProductPriceUnitBasedCreate
        | ProductPriceMeteredUnitCreate
        | ProductPriceMeteredTiersCreate,
        Discriminator("amount_type"),
    ],
    BeforeValidator(_coerce_legacy_free_price),
]

ProductPriceCreateList = Annotated[
    list[ProductPriceCreate], Field(min_length=1), PRICE_CREATE_LIST_SCHEMA
]


class ProductCreateRecurring(schemas.ProductCreateRecurring):
    prices: ProductPriceCreateList = Field(  # type: ignore[assignment]
        ..., description=PRODUCT_CREATE_PRICES_DESCRIPTION
    )


class ProductCreateOneTime(schemas.ProductCreateOneTime):
    prices: ProductPriceCreateList = Field(  # type: ignore[assignment]
        ..., description=PRODUCT_CREATE_PRICES_DESCRIPTION
    )


ProductCreate = Annotated[
    Annotated[ProductCreateRecurring, Tag("recurring")]
    | Annotated[ProductCreateOneTime, Tag("one_time")],
    Discriminator(_product_create_discriminator),
    SetSchemaReference("ProductCreate"),
]

ProductPriceUpdate = Annotated[
    ExistingProductPrice | ProductPriceCreate, Field(union_mode="left_to_right")
]


class ProductUpdate(schemas.ProductUpdate):
    """
    Schema to update a product.
    """

    recurring_interval: Omissible[SubscriptionRecurringInterval] = Field(
        default=MISSING,
        description=(
            "The recurring interval of the product. "
            "If `None`, the product is a one-time purchase. "
            "**Can only be set on legacy recurring products. "
            "Once set, it can't be changed.**"
        ),
    )
    recurring_interval_count: Omissible[int] = Field(
        default=MISSING,
        ge=1,
        le=999,
        description=(
            "Number of interval units of the subscription. "
            "If this is set to 1 the charge will happen every interval (e.g. every month), "
            "if set to 2 it will be every other month, and so on. "
            "Once set, it can't be changed.**"
        ),
    )
    prices: Omissible[list[ProductPriceUpdate]] = Field(  # type: ignore[assignment]
        default=MISSING, description=PRODUCT_UPDATE_PRICES_DESCRIPTION
    )
