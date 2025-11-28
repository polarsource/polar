from datetime import datetime
from enum import StrEnum
from typing import Literal

from dateutil.relativedelta import relativedelta


class Platforms(StrEnum):
    github = "github"


class PaymentProcessor(StrEnum):
    stripe = "stripe"


class AccountType(StrEnum):
    stripe = "stripe"
    manual = "manual"
    open_collective = "open_collective"

    def get_display_name(self) -> str:
        return {
            AccountType.stripe: "Stripe Connect Express",
            AccountType.open_collective: "Open Collective",
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
    invoice = "invoice"  # Invoice immediately
    prorate = "prorate"  # Add prorations to next invoice

    def to_stripe(self) -> Literal["always_invoice", "create_prorations"]:
        if self == SubscriptionProrationBehavior.invoice:
            return "always_invoice"
        if self == SubscriptionProrationBehavior.prorate:
            return "create_prorations"
        raise ValueError(f"Invalid proration behavior: {self}")


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


class RateLimitGroup(StrEnum):
    web = "web"
    restricted = "restricted"
    default = "default"
    elevated = "elevated"
