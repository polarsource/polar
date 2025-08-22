from typing import Annotated

from pydantic import UUID4, AfterValidator, TypeAdapter

from polar.kit.address import Address
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import (
    ClassName,
    EmptyStrToNoneValidator,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.kit.tax import TaxID
from polar.payment_method.schemas import PaymentMethodCard, PaymentMethodGeneric


class CustomerPortalOAuthAccount(Schema):
    account_id: str
    account_username: str | None


class CustomerPortalCustomer(IDSchema, TimestampedSchema):
    email: str
    email_verified: bool
    name: str | None
    billing_name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    oauth_accounts: dict[str, CustomerPortalOAuthAccount]
    default_payment_method_id: UUID4 | None = None


class CustomerPortalCustomerUpdate(Schema):
    billing_name: Annotated[str | None, EmptyStrToNoneValidator] = None
    billing_address: Address | None = None
    tax_id: Annotated[str | None, EmptyStrToNoneValidator] = None


CustomerPaymentMethod = Annotated[
    PaymentMethodCard | PaymentMethodGeneric,
    SetSchemaReference("CustomerPaymentMethod"),
    MergeJSONSchema({"title": "CustomerPaymentMethod"}),
    ClassName("CustomerPaymentMethod"),
]

CustomerPaymentMethodTypeAdapter: TypeAdapter[CustomerPaymentMethod] = TypeAdapter(
    CustomerPaymentMethod
)


class CustomerPaymentMethodCreate(Schema):
    confirmation_token_id: str
    set_default: bool
    return_url: Annotated[str, AfterValidator(get_safe_return_url)]
