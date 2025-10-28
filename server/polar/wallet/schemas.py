from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.exceptions import ResourceNotFound
from polar.kit.schemas import CUSTOMER_ID_EXAMPLE, IDSchema, Schema, TimestampedSchema

WalletID = Annotated[UUID4, Path(description="The wallet ID.")]

WalletNotFound = {
    "description": "Wallet not found.",
    "model": ResourceNotFound.schema(),
}


class WalletBase(TimestampedSchema, IDSchema):
    customer_id: UUID4 = Field(
        description="The ID of the customer that owns the wallet.",
        examples=[CUSTOMER_ID_EXAMPLE],
    )
    balance: int = Field(
        description="The current balance of the wallet, in cents.", examples=[50_00]
    )
    currency: str = Field(description="The currency of the wallet.", examples=["usd"])


class Wallet(WalletBase):
    """
    A wallet represents a customer's balance in your organization.

    They can top-up their wallet, and use the balance to pay for usage.
    """

    pass


class WalletTopUpCreate(Schema):
    """
    Request schema to top-up a wallet.
    """

    amount: int = Field(
        description="The amount to top-up the wallet by, in cents.", examples=[20_00]
    )
    currency: str = Field(
        pattern="usd",
        description=(
            "The currency. Currently, only `usd` is supported. "
            "It should match the wallet's currency."
        ),
    )
