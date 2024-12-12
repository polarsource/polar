from polar.kit.address import Address
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
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
