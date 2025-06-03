from pydantic import UUID4

from polar.enums import AccountType
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.payout import PayoutStatus


class PayoutCreate(Schema):
    account_id: UUID4


class PayoutEstimate(Schema):
    account_id: UUID4
    gross_amount: int
    fees_amount: int
    net_amount: int


class Payout(IDSchema, TimestampedSchema):
    processor: AccountType
    status: PayoutStatus
    currency: str
    amount: int
    account_currency: str
    account_amount: int
    account_id: UUID4
