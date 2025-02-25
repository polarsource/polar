from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, AliasPath, Field, TypeAdapter

from polar.kit.address import Address
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import (
    EmailStrDNS,
    EmptyStrToNoneValidator,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.tax import TaxID


class CustomerPortalOAuthAccount(Schema):
    account_id: str
    account_username: str | None


class CustomerPortalCustomer(IDSchema, TimestampedSchema):
    email: str
    email_verified: bool
    name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    oauth_accounts: dict[str, CustomerPortalOAuthAccount]


class CustomerPortalCustomerUpdate(Schema):
    email: Annotated[EmailStrDNS | None, EmptyStrToNoneValidator] = None
    name: Annotated[str | None, EmptyStrToNoneValidator] = None
    billing_address: Address | None = None
    tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None


class PaymentMethodGeneric(Schema):
    id: str
    type: str
    created_at: datetime = Field(validation_alias="created")
    default: bool


class PaymentMethodCardData(Schema):
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    wallet: str | None = Field(
        default=None, validation_alias=AliasPath("wallet", "type")
    )


class PaymentMethodCard(PaymentMethodGeneric):
    type: Literal["card"]
    card: PaymentMethodCardData


CustomerPaymentMethod = PaymentMethodCard | PaymentMethodGeneric

CustomerPaymentMethodTypeAdapter: TypeAdapter[CustomerPaymentMethod] = TypeAdapter(
    CustomerPaymentMethod
)


class CustomerPaymentMethodCreate(Schema):
    confirmation_token_id: str
    set_default: bool
    return_url: Annotated[str, AfterValidator(get_safe_return_url)]
