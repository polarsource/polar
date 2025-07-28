from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from babel.numbers import format_currency
from pydantic import UUID4, BaseModel, Discriminator, computed_field

from polar.email.react import render_email_template
from polar.kit.schemas import Schema


class NotificationType(StrEnum):
    maintainer_account_under_review = "MaintainerAccountUnderReviewNotification"
    maintainer_account_reviewed = "MaintainerAccountReviewedNotification"
    maintainer_organization_under_review = (
        "MaintainerOrganizationUnderReviewNotification"
    )
    maintainer_organization_reviewed = "MaintainerOrganizationReviewedNotification"
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
        return self.subject(), render_email_template(
            self.template_name(), self.model_dump()
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


class MaintainerAccountUnderReviewNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_under_review]
    payload: MaintainerAccountUnderReviewNotificationPayload


class MaintainerAccountReviewedNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your Polar account review is now complete"

    @classmethod
    def template_name(cls) -> str:
        return "notification_account_reviewed"


class MaintainerAccountReviewedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_reviewed]
    payload: MaintainerAccountReviewedNotificationPayload


class MaintainerOrganizationUnderReviewNotificationPayload(NotificationPayloadBase):
    organization_name: str

    def subject(self) -> str:
        return f"Your organization {self.organization_name} is being reviewed"

    @classmethod
    def template_name(cls) -> str:
        return "notification_organization_under_review"


class MaintainerOrganizationUnderReviewNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_organization_under_review]
    payload: MaintainerOrganizationUnderReviewNotificationPayload


class MaintainerOrganizationReviewedNotificationPayload(NotificationPayloadBase):
    organization_name: str

    def subject(self) -> str:
        return f"Your organization {self.organization_name} review is now complete"

    @classmethod
    def template_name(cls) -> str:
        return "notification_organization_reviewed"


class MaintainerOrganizationReviewedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_organization_reviewed]
    payload: MaintainerOrganizationReviewedNotificationPayload


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
                f"{self.formatted_price_amount}/{self.tier_price_recurring_interval} "
            )
        else:
            price = "free"
        return f"Congrats! You have a new subscriber on {self.tier_name} ({price})!"

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
        return f"Congrats! You've made a new sale ({self.formatted_price_amount})!"

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
    MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerOrganizationUnderReviewNotificationPayload
    | MaintainerOrganizationReviewedNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload
    | MaintainerCreateAccountNotificationPayload
)

Notification = Annotated[
    MaintainerAccountUnderReviewNotification
    | MaintainerAccountReviewedNotification
    | MaintainerOrganizationUnderReviewNotification
    | MaintainerOrganizationReviewedNotification
    | MaintainerNewPaidSubscriptionNotification
    | MaintainerNewProductSaleNotification
    | MaintainerCreateAccountNotification,
    Discriminator(discriminator="type"),
]
