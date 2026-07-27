from datetime import datetime

from pydantic import UUID4, Field

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.pledge import PledgeState
from polar.models.transaction import PlatformFeeType, Processor, TransactionType


class TransactionUser(IDSchema, Schema):
    public_name: str
    avatar_url: str


class TransactionPledge(IDSchema, TimestampedSchema):
    state: PledgeState
    issue_reference: str


class TransactionOrganization(IDSchema, TimestampedSchema):
    name: str
    slug: str
    avatar_url: str | None


class TransactionIssueReward(IDSchema, TimestampedSchema):
    issue_reference: str
    share_thousands: int


class TransactionProduct(IDSchema, TimestampedSchema):
    name: str
    recurring_interval: SubscriptionRecurringInterval | None
    organization_id: UUID4 | None
    organization: TransactionOrganization | None


class TransactionOrder(IDSchema, TimestampedSchema):
    product: TransactionProduct | None
    subscription_id: UUID4 | None


class TransactionEmbedded(IDSchema, TimestampedSchema):
    type: TransactionType
    processor: Processor | None

    currency: str
    amount: int
    tax_amount: int
    account_currency: str
    account_amount: int

    presentment_amount: int | None
    presentment_tax_amount: int | None
    presentment_currency: str | None
    exchange_rate: float | None

    platform_fee_type: PlatformFeeType | None

    pledge_id: UUID4 | None
    issue_reward_id: UUID4 | None
    order_id: UUID4 | None

    payout_transaction_id: UUID4 | None
    incurred_by_transaction_id: UUID4 | None


class Transaction(TransactionEmbedded):
    pledge: TransactionPledge | None
    issue_reward: TransactionIssueReward | None
    order: TransactionOrder | None

    account_incurred_transactions: list[TransactionEmbedded]
    payment_transaction: TransactionEmbedded | None

    incurred_amount: int
    gross_amount: int
    net_amount: int


class TransactionsBalance(Schema):
    currency: str
    amount: int
    account_currency: str
    account_amount: int


class TransactionsHeldBalance(TransactionsBalance):
    next_release_at: datetime | None = Field(
        description="When the next chunk of the held balance becomes available for payout."
    )
    next_release_amount: int = Field(
        description="Amount becoming available for payout at `next_release_at`."
    )
    next_release_account_amount: int = Field(
        description=(
            "Amount becoming available for payout at `next_release_at`, "
            "in the account's currency."
        )
    )
    fully_available_at: datetime | None = Field(
        description="When the whole held balance has become available for payout."
    )


class TransactionsSummary(Schema):
    balance: TransactionsBalance
    available_balance: TransactionsBalance
    held_balance: TransactionsHeldBalance
    payout: TransactionsBalance
