from datetime import datetime
from enum import StrEnum
from typing import Literal

from dateutil.relativedelta import relativedelta


class Platforms(StrEnum):
    github = "github"


class PaymentProcessor(StrEnum):
    stripe = "stripe"


class TaxProcessor(StrEnum):
    stripe = "stripe"
    numeral = "numeral"


class TaxBehavior(StrEnum):
    inclusive = "inclusive"
    exclusive = "exclusive"

    def to_option(self) -> "TaxBehaviorOption":
        match self:
            case TaxBehavior.inclusive:
                return TaxBehaviorOption.inclusive
            case TaxBehavior.exclusive:
                return TaxBehaviorOption.exclusive

    def to_stripe(self) -> Literal["inclusive", "exclusive"]:
        match self:
            case TaxBehavior.inclusive:
                return "inclusive"
            case TaxBehavior.exclusive:
                return "exclusive"


class TaxBehaviorOption(StrEnum):
    location = "location"
    inclusive = "inclusive"
    exclusive = "exclusive"


class AccountType(StrEnum):
    stripe = "stripe"
    manual = "manual"

    def get_display_name(self) -> str:
        return {
            AccountType.stripe: "Stripe Connect Express",
            AccountType.manual: "Manual",
        }[self]


class SubscriptionRecurringInterval(StrEnum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["day", "week", "month", "year"]:
        return self.value

    def get_next_period(self, d: datetime, leap: int = 1) -> datetime:
        match self:
            case SubscriptionRecurringInterval.day:
                return d + relativedelta(days=leap)
            case SubscriptionRecurringInterval.week:
                return d + relativedelta(weeks=leap)
            case SubscriptionRecurringInterval.month:
                return d + relativedelta(months=leap)
            case SubscriptionRecurringInterval.year:
                return d + relativedelta(years=leap)


class SubscriptionProrationBehavior(StrEnum):
    invoice = "invoice"
    """Invoice immediately, and add prorations to the invoice."""
    prorate = "prorate"
    """Don't invoice immediately, but add prorations to the next invoice."""
    next_period = "next_period"
    """Don't invoice immediately, and don't add prorations. The new price will be applied at the start of the next period."""


class InvoiceNumbering(StrEnum):
    organization = "organization"
    customer = "customer"


class TokenType(StrEnum):
    client_secret = "polar_client_secret"
    client_registration_token = "polar_client_registration_token"
    authorization_code = "polar_authorization_code"
    access_token = "polar_access_token"
    refresh_token = "polar_refresh_token"
    personal_access_token = "polar_personal_access_token"
    organization_access_token = "polar_organization_access_token"
    customer_session_token = "polar_customer_session_token"
    user_session_token = "polar_user_session_token"


class EmailSender(StrEnum):
    logger = "logger"
    resend = "resend"


class RateLimitGroup(StrEnum):
    web = "web"
    restricted = "restricted"
    default = "default"
    elevated = "elevated"


class PaymentMode(StrEnum):
    """
    Internal flag to distinguish payment processing behaviour.
    """

    sync = "sync"
    """
    The payment is processed synchronously, and fails the operation if the payment fails.

    Typical mode for subscription updates that require immediate payment.
    """

    background = "background"
    """
    The payment is processed asynchronously in the background, and doesn't affect the operation's result.

    Typical mode for subscription cycle orders that can be retried.
    """
