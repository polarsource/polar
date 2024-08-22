from pydantic import UUID4, Field

from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.pledge import PledgeState
from polar.models.product import SubscriptionTierType
from polar.models.transaction import PaymentProcessor, PlatformFeeType, TransactionType
from polar.product.schemas import ProductPrice


class TransactionExternalOrganization(TimestampedSchema):
    id: UUID4
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool


class TransactionRepository(TimestampedSchema):
    id: UUID4
    platform: Platforms
    organization_id: UUID4
    name: str


class TransactionUser(Schema):
    id: UUID4
    public_name: str
    avatar_url: str


class TransactionIssue(TimestampedSchema):
    id: UUID4
    platform: Platforms
    organization_id: UUID4
    repository_id: UUID4
    number: int
    title: str

    organization: TransactionExternalOrganization
    repository: TransactionRepository


class TransactionPledge(TimestampedSchema):
    id: UUID4
    state: PledgeState
    issue: TransactionIssue


class TransactionOrganization(TimestampedSchema):
    id: UUID4
    name: str
    slug: str
    avatar_url: str | None


class TransactionDonation(TimestampedSchema):
    id: UUID4
    to_organization: TransactionOrganization | None


class TransactionIssueReward(TimestampedSchema):
    id: UUID4
    issue_id: UUID4
    share_thousands: int


class TransactionProduct(TimestampedSchema):
    id: UUID4
    name: str
    organization_id: UUID4 | None
    organization: TransactionOrganization | None
    type: SubscriptionTierType | None = Field(deprecated=True)


TransactionProductPrice = ProductPrice


class TransactionOrder(TimestampedSchema):
    id: UUID4
    product: TransactionProduct
    product_price: TransactionProductPrice
    subscription_id: UUID4 | None


class TransactionEmbedded(TimestampedSchema):
    id: UUID4
    type: TransactionType
    processor: PaymentProcessor | None

    currency: str
    amount: int
    account_currency: str
    account_amount: int

    platform_fee_type: PlatformFeeType | None

    pledge_id: UUID4 | None
    issue_reward_id: UUID4 | None
    order_id: UUID4 | None
    donation_id: UUID4 | None

    payout_transaction_id: UUID4 | None
    incurred_by_transaction_id: UUID4 | None


class Transaction(TransactionEmbedded):
    pledge: TransactionPledge | None
    issue_reward: TransactionIssueReward | None
    order: TransactionOrder | None
    donation: TransactionDonation | None

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
