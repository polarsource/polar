from pydantic import UUID4

from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.pledge import PledgeState
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.subscription_tier_price import SubscriptionTierPriceRecurringInterval
from polar.models.transaction import PaymentProcessor, PlatformFeeType, TransactionType


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


class TransactionDonation(TimestampedSchema):
    id: UUID4
    to_organization: TransactionOrganization | None = None


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


class TransactionSubscriptionPrice(TimestampedSchema):
    id: UUID4
    recurring_interval: SubscriptionTierPriceRecurringInterval
    price_amount: int
    price_currency: str
    is_archived: bool


class TransactionSubscription(TimestampedSchema):
    id: UUID4
    status: SubscriptionStatus
    subscription_tier: TransactionSubscriptionTier


class TransactionEmbedded(TimestampedSchema):
    id: UUID4
    type: TransactionType
    processor: PaymentProcessor | None = None

    currency: str
    amount: int
    account_currency: str
    account_amount: int

    platform_fee_type: PlatformFeeType | None = None

    pledge_id: UUID4 | None = None
    issue_reward_id: UUID4 | None = None
    subscription_id: UUID4 | None = None
    subscription_tier_price_id: UUID4 | None = None

    payout_transaction_id: UUID4 | None = None
    incurred_by_transaction_id: UUID4 | None = None


class Transaction(TransactionEmbedded):
    pledge: TransactionPledge | None = None
    issue_reward: TransactionIssueReward | None = None
    subscription: TransactionSubscription | None = None
    subscription_tier_price: TransactionSubscriptionPrice | None = None
    donation: TransactionDonation | None = None

    account_incurred_transactions: list[TransactionEmbedded]

    incurred_amount: int
    gross_amount: int
    net_amount: int


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


class PayoutEstimate(Schema):
    account_id: UUID4
    gross_amount: int
    fees_amount: int
    net_amount: int
