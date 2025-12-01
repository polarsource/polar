from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

import pycountry
from babel.numbers import format_currency
from pydantic import UUID4, BaseModel, Discriminator, computed_field

from polar.config import settings
from polar.email.react import render_email_template
from polar.kit.schemas import Schema
from polar.models.order import OrderBillingReasonInternal


class NotificationType(StrEnum):
    maintainer_new_paid_subscription = "MaintainerNewPaidSubscriptionNotification"
    maintainer_new_product_sale = "MaintainerNewProductSaleNotification"
    maintainer_create_account = "MaintainerCreateAccountNotification"


class NotificationPayloadBase(BaseModel):
    @abstractmethod
    def subject(self) -> str:
        pass

    @classmethod
    @abstractmethod
    def template_name(cls) -> str:
        pass

    def render(self) -> tuple[str, str]:
        from polar.email.schemas import EmailAdapter

        return self.subject(), render_email_template(
            EmailAdapter.validate_python(
                {
                    "template": self.template_name(),
                    "props": self,
                }
            )
        )


class NotificationBase(Schema):
    id: UUID4
    created_at: datetime
    type: NotificationType


class MaintainerAccountUnderReviewNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your Polar account is being reviewed"

    @classmethod
    def template_name(cls) -> str:
        return "notification_account_under_review"


class MaintainerNewPaidSubscriptionNotificationPayload(NotificationPayloadBase):
    subscriber_name: str
    tier_name: str
    tier_price_amount: int | None
    tier_price_recurring_interval: str
    tier_organization_name: str

    @computed_field
    def formatted_price_amount(self) -> str:
        if self.tier_price_amount is None:
            return ""
        return format_currency(self.tier_price_amount / 100, "USD", locale="en_US")

    def subject(self) -> str:
        if self.tier_price_amount:
            price = (
                f"{self.formatted_price_amount}/{self.tier_price_recurring_interval}"
            )
        else:
            price = "free"
        return f"You have a new subscriber on {self.tier_name} ({price})!"

    @classmethod
    def template_name(cls) -> str:
        return "notification_new_subscription"


class MaintainerNewPaidSubscriptionNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_new_paid_subscription]
    payload: MaintainerNewPaidSubscriptionNotificationPayload


class MaintainerNewProductSaleNotificationPayload(NotificationPayloadBase):
    product_name: str
    product_price_amount: int
    customer_name: str = ""
    organization_name: str = ""

    customer_email: str | None = None
    billing_address_country: str | None = None
    billing_address_city: str | None = None
    billing_address_line1: str | None = None
    product_image_url: str | None = None
    order_id: str | None = None
    order_date: str | None = None
    organization_slug: str | None = None
    billing_reason: OrderBillingReasonInternal | None = None

    @computed_field
    def formatted_price_amount(self) -> str:
        return format_currency(self.product_price_amount / 100, "USD", locale="en_US")

    @computed_field
    def formatted_billing_reason(self) -> str | None:
        if self.billing_reason is None:
            return None
        match self.billing_reason:
            case OrderBillingReasonInternal.purchase:
                return "One-time purchase"
            case OrderBillingReasonInternal.subscription_create:
                return "New subscription"
            case OrderBillingReasonInternal.subscription_cycle:
                return "Subscription renewal"
            case OrderBillingReasonInternal.subscription_cycle_after_trial:
                return "Subscription started after trial"
            case OrderBillingReasonInternal.subscription_update:
                return "Subscription update"

    @computed_field
    def formatted_address_country(self) -> str | None:
        if not self.billing_address_country:
            return None
        country = pycountry.countries.get(alpha_2=self.billing_address_country)
        return country.name if country else self.billing_address_country

    @computed_field
    def order_url(self) -> str | None:
        if not self.organization_slug or not self.order_id:
            return None
        return f"{settings.FRONTEND_BASE_URL}/dashboard/{self.organization_slug}/sales/{self.order_id}"

    def subject(self) -> str:
        return f"You've made a new sale ({self.formatted_price_amount})!"

    @classmethod
    def template_name(cls) -> str:
        return "notification_new_sale"


class MaintainerNewProductSaleNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_new_product_sale]
    payload: MaintainerNewProductSaleNotificationPayload


class MaintainerCreateAccountNotificationPayload(NotificationPayloadBase):
    organization_name: str
    url: str

    def subject(self) -> str:
        return (
            f"Create a payout account for {self.organization_name} now to receive funds"
        )

    @classmethod
    def template_name(cls) -> str:
        return "notification_create_account"


class MaintainerCreateAccountNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_create_account]
    payload: MaintainerCreateAccountNotificationPayload


NotificationPayload = (
    MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload
    | MaintainerCreateAccountNotificationPayload
)

Notification = Annotated[
    MaintainerNewPaidSubscriptionNotification
    | MaintainerNewProductSaleNotification
    | MaintainerCreateAccountNotification,
    Discriminator(discriminator="type"),
]
