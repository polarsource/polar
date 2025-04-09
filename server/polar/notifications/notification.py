from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import UUID4, BaseModel, Discriminator

from polar.email.renderer import get_email_renderer
from polar.kit.money import get_cents_in_dollar_string
from polar.kit.schemas import Schema


class NotificationType(StrEnum):
    maintainer_account_under_review = "MaintainerAccountUnderReviewNotification"
    maintainer_account_reviewed = "MaintainerAccountReviewedNotification"
    maintainer_new_paid_subscription = "MaintainerNewPaidSubscriptionNotification"
    maintainer_new_product_sale = "MaintainerNewProductSaleNotification"
    maintainer_create_account = "MaintainerCreateAccountNotification"


class NotificationPayloadBase(BaseModel):
    @abstractmethod
    def subject(self) -> str:
        pass

    @abstractmethod
    def body(self) -> str:
        pass

    def render(self) -> tuple[str, str]:
        m: dict[str, str] = vars(self)

        email_renderer = get_email_renderer()
        return email_renderer.render_from_string(self.subject(), self.body(), m)


class NotificationBase(Schema):
    id: UUID4
    created_at: datetime
    type: NotificationType


class MaintainerAccountUnderReviewNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your Polar account is being reviewed"

    def body(self) -> str:
        return f"""Hi there,<br><br>

Sorry, we don't mean to scare you. Account reviews are completely normal and
part of our ongoing compliance efforts here at Polar.<br><br>

Currently, your {self.account_type} and organizations connected to it is being
reviewed as part of this automated process.<br><br>

We perform them ahead of the first payout and then automatically after certain sales thresholds.<br><br>

You can read more about our account reviews here:<br>
https://dub.sh/polar-review

So no cause to be concerned. Typically, our reviews are completed within 24-48h.<br><br>

We'll reach out shortly in case we need any further information from you for our review.<br><br>
"""  # noqa: E501


class MaintainerAccountUnderReviewNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_under_review]
    payload: MaintainerAccountUnderReviewNotificationPayload


class MaintainerAccountReviewedNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your Polar account is now completed"

    def body(self) -> str:
        return """Hi,<br><br>

We are pleased to inform you that the review of your Polar account has been
successfully completed.<br><br>

We appreciate your patience throughout this process.<br><br>
"""  # noqa: E501


class MaintainerAccountReviewedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_reviewed]
    payload: MaintainerAccountReviewedNotificationPayload


class MaintainerNewPaidSubscriptionNotificationPayload(NotificationPayloadBase):
    subscriber_name: str
    tier_name: str
    tier_price_amount: int | None
    tier_price_recurring_interval: str
    tier_organization_name: str

    def subject(self) -> str:
        if self.tier_price_amount is None:
            return "Congrats! You have a new free subscriber!"
        return f"Congrats! You have a new subscriber on {self.tier_name} (${get_cents_in_dollar_string(self.tier_price_amount)}/{self.tier_price_recurring_interval})!"

    def body(self) -> str:
        return f"""Congratulations!<br><br>

{self.subscriber_name} is now subscribing to <strong>{self.tier_name}</strong> for ${get_cents_in_dollar_string(self.tier_price_amount) if self.tier_price_amount is not None else "free"}/{self.tier_price_recurring_interval}.<br><br>
"""  # noqa: E501


class MaintainerNewPaidSubscriptionNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_new_paid_subscription]
    payload: MaintainerNewPaidSubscriptionNotificationPayload


class MaintainerNewProductSaleNotificationPayload(NotificationPayloadBase):
    customer_name: str
    product_name: str
    product_price_amount: int
    organization_name: str

    def subject(self) -> str:
        return f"Congrats! You've made a new sale (${get_cents_in_dollar_string(self.product_price_amount)})!"

    def body(self) -> str:
        return f"""Congratulations!<br><br>

{self.customer_name} purchased <strong>{self.product_name}</strong> for ${get_cents_in_dollar_string(self.product_price_amount)}.<br><br>
"""  # noqa: E501


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

    def body(self) -> str:
        return f"""<h1>Hi,</h1>

<p>Now that you got your first payment to {self.organization_name}, you should create a payout account in order to receive your funds.</p>

<p>We support Stripe and Open Collective. This operation only takes a few minutes and allows you to receive your money immediately.</p>

<table class="body-action" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
        <td align="center">
            <!-- Border based button
https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                    <td align="center">
                        <a href="{self.url}" class="f-fallback button">Create my payout account</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
<!-- Sub copy -->
<table class="body-sub" role="presentation">
    <tr>
        <td>
            <p class="f-fallback sub">If you're having trouble with the button above, copy and paste the URL below into
                your web browser.</p>
            <p class="f-fallback sub"><a href="{self.url}">{self.url}</a></p>
        </td>
    </tr>
</table>
"""  # noqa: E501


class MaintainerCreateAccountNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_create_account]
    payload: MaintainerCreateAccountNotificationPayload


NotificationPayload = (
    MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload
    | MaintainerCreateAccountNotificationPayload
)

Notification = Annotated[
    MaintainerAccountUnderReviewNotification
    | MaintainerAccountReviewedNotification
    | MaintainerNewPaidSubscriptionNotification
    | MaintainerNewProductSaleNotification
    | MaintainerCreateAccountNotification,
    Discriminator(discriminator="type"),
]
