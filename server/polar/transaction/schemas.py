from pydantic import UUID4, computed_field

from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.pledge import PledgeState
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
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

    payout_transaction_id: UUID4 | None = None
    incurred_by_transaction_id: UUID4 | None = None


class Transaction(TransactionEmbedded):
    pledge: TransactionPledge | None = None
    issue_reward: TransactionIssueReward | None = None
    subscription: TransactionSubscription | None = None

    account_incurred_transactions: list[TransactionEmbedded]

    @computed_field  # type: ignore[misc]
    @property
    def incurred_amount(self) -> int:
        return sum(
            transaction.amount for transaction in self.account_incurred_transactions
        )

    @computed_field  # type: ignore[misc]
    @property
    def gross_amount(self) -> int:
        inclusive = 0 if self.type == TransactionType.balance else 1
        return self.amount + inclusive * self.incurred_amount

    @computed_field  # type: ignore[misc]
    @property
    def net_amount(self) -> int:
        inclusive = 1 if self.type == TransactionType.balance else -1
        return self.gross_amount + inclusive * self.incurred_amount


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
