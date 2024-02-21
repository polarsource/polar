from pydantic import UUID4

from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.pledge import PledgeState
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.transaction import PaymentProcessor, TransactionType


class TransactionRepository(TimestampedSchema):
    id: UUID4
    platform: Platforms
    organization_id: UUID4
    name: str


class TransactionOrganization(TimestampedSchema):
    id: UUID4
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool


class TransactionIssue(TimestampedSchema):
    id: UUID4
    platform: Platforms
    organization_id: UUID4
    repository_id: UUID4
    number: int
    title: str

    organization: TransactionOrganization
    repository: TransactionRepository


class TransactionPledge(TimestampedSchema):
    id: UUID4
    state: PledgeState
    issue: TransactionIssue


class TransactionIssueReward(TimestampedSchema):
    id: UUID4
    issue_id: UUID4
    share_thousands: int


class TransactionSubscriptionTier(TimestampedSchema):
    id: UUID4
    type: SubscriptionTierType
    name: str
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None

    organization: TransactionOrganization | None = None
    repository: TransactionRepository | None = None


class TransactionSubscription(TimestampedSchema):
    id: UUID4
    status: SubscriptionStatus
    price_currency: str
    price_amount: int
    subscription_tier: TransactionSubscriptionTier


class Transaction(TimestampedSchema):
    id: UUID4
    type: TransactionType
    processor: PaymentProcessor | None = None

    currency: str
    amount: int
    account_currency: str
    account_amount: int

    pledge_id: UUID4 | None = None
    issue_reward_id: UUID4 | None = None
    subscription_id: UUID4 | None = None

    payout_transaction_id: UUID4 | None = None

    pledge: TransactionPledge | None = None
    issue_reward: TransactionIssueReward | None = None
    subscription: TransactionSubscription | None = None


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


class PayoutCreate(Schema):
    account_id: UUID4
