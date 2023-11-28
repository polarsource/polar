from pydantic import UUID4

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.transaction import PaymentProcessor, TransactionType


class Transaction(TimestampedSchema):
    id: UUID4
    type: TransactionType
    processor: PaymentProcessor

    currency: str
    amount: int
    account_currency: str
    account_amount: int

    pledge_id: UUID4 | None = None
    issue_reward_id: UUID4 | None = None
    subscription_id: UUID4 | None = None

    payout_transaction_id: UUID4 | None = None


class TransactionDetails(Transaction):
    paid_transactions: list[Transaction]


class TransactionsBalance(Schema):
    currency: str
    amount: int
    account_currency: str
    account_amount: int


class TransactionsSummary(Schema):
    balance: TransactionsBalance
    payout: TransactionsBalance
