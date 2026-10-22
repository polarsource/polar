from typing import Annotated, Self

from pydantic import Discriminator, Field, model_validator

from polar.kit.currency import PresentmentCurrency

from . import schemas
from .schemas import Amount, Amounts, Currency, DiscountPercentageCreate


class DiscountFixedCreate(schemas.DiscountFixedCreate):
    amount: Amount | None = Field(
        default=None,
        deprecated="Use `amounts` instead to specify fixed discount amounts for different currencies.",
    )
    currency: Currency | None = Field(
        default=PresentmentCurrency.usd,
        deprecated="Use `amounts` instead to specify fixed discount amounts for different currencies.",
    )
    amounts: Amounts | None = None  # type: ignore[assignment]

    @model_validator(mode="after")
    def validate_either_amount_or_amounts(self) -> Self:
        if self.amount is not None and self.amounts is not None:
            raise ValueError("Cannot specify both `amount` and `amounts`.")
        if self.amount is None and self.amounts is None:
            raise ValueError("Must specify either `amount` or `amounts`.")
        return self


class DiscountUpdate(schemas.DiscountUpdate):
    amount: Amount | None = Field(
        default=None,
        deprecated="Use `amounts` instead to specify fixed discount amounts for different currencies.",
    )
    currency: Currency | None = Field(
        default=None,
        deprecated="Use `amounts` instead to specify fixed discount amounts for different currencies.",
    )

    @model_validator(mode="after")
    def validate_either_amount_or_amounts(self) -> Self:
        if self.amount is not None and self.amounts is not None:
            raise ValueError("Cannot specify both `amount` and `amounts`.")
        return self


DiscountCreate = Annotated[
    DiscountFixedCreate | DiscountPercentageCreate,
    Discriminator("type"),
]
