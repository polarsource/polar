from datetime import datetime
from uuid import UUID

from pydantic import UUID4, AliasPath, Field

from polar.enums import AccountType
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.payout import PayoutStatus
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.transaction.schemas import TransactionEmbedded


class PayoutCreate(Schema):
    account_id: UUID4


class PayoutEstimate(Schema):
    account_id: UUID4
    gross_amount: int
    fees_amount: int
    net_amount: int


class PayoutAttempt(IDSchema, TimestampedSchema):
    payout_id: UUID
    processor: AccountType
    processor_id: str | None
    status: PayoutAttemptStatus
    amount: int
    currency: str
    failed_reason: str | None
    paid_at: datetime | None


class Payout(IDSchema, TimestampedSchema):
    processor: AccountType
    status: PayoutStatus
    paid_at: datetime | None
    currency: str
    amount: int
    fees_amount: int
    gross_amount: int
    account_currency: str
    account_amount: int
    account_id: UUID4

    invoice_number: str | None = None
    is_invoice_generated: bool

    transaction_id: UUID4 = Field(validation_alias=AliasPath("transaction", "id"))
    fees_transactions: list[TransactionEmbedded]

    attempts: list[PayoutAttempt]


class PayoutGenerateInvoice(Schema):
    invoice_number: str | None = None


class PayoutInvoice(Schema):
    url: str
