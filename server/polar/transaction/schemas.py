from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.transaction import PaymentProcessor, TransactionType


class Transaction(TimestampedSchema):
    type: TransactionType
    processor: PaymentProcessor

    currency: str
    amount: int
    account_currency: str
    account_amount: int

    pledge_id: str | None
    issue_reward_id: str | None
    subscription_id: str | None

    payout_transaction_id: str | None


class TransactionsBalance(Schema):
    currency: str
    amount: int
    account_currency: str
    account_amount: int


class TransactionsSummary(Schema):
    balance: TransactionsBalance
    payout: TransactionsBalance
