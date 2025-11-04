from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from babel.numbers import format_currency
from pydantic import UUID4, BaseModel, Discriminator, computed_field

from polar.email.react import render_email_template
from polar.kit.schemas import Schema


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
    customer_name: str
    product_name: str
    product_price_amount: int
    organization_name: str

    @computed_field
    def formatted_price_amount(self) -> str:
        return format_currency(self.product_price_amount / 100, "USD", locale="en_US")

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
