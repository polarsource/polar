from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from babel.numbers import format_currency
from pydantic import UUID4, BaseModel, Discriminator, computed_field

from polar.email.react import render_email_template
from polar.kit.html import dangerously_strip_tags
from polar.kit.schemas import Schema


class NotificationType(StrEnum):
    maintainer_account_under_review = "MaintainerAccountUnderReviewNotification"
    maintainer_account_reviewed = "MaintainerAccountReviewedNotification"
    maintainer_new_paid_subscription = "MaintainerNewPaidSubscriptionNotification"
    maintainer_new_product_sale = "MaintainerNewProductSaleNotification"
    maintainer_create_account = "MaintainerCreateAccountNotification"


class NotificationPayloadBase(BaseModel):
    @classmethod
    @abstractmethod
    def subject(cls) -> str:
        pass

    @classmethod
    @abstractmethod
    def body(cls) -> str:
        pass

    def render(self) -> tuple[str, str]:
        bodyHTML = self.body()
        context = {
            **self.model_dump(),
            "bodyHTML": bodyHTML,
            "preview": dangerously_strip_tags(bodyHTML),
        }
        return self.subject(), render_email_template("notification_generic", context)


class NotificationBase(Schema):
    id: UUID4
    created_at: datetime
    type: NotificationType


class MaintainerAccountUnderReviewNotificationPayload(NotificationPayloadBase):
    account_type: str

    @classmethod
    def subject(cls) -> str:
        return "Your Polar account is being reviewed"

    @classmethod
    def body(cls) -> str:
        return """Hi there,<br><br>

Sorry, we don't mean to scare you. Account reviews are completely normal and
part of our ongoing compliance efforts here at Polar.<br><br>

Currently, your {{account_type}} and organizations connected to it is being
reviewed as part of this automated process.<br><br>

We perform them ahead of the first payout and then automatically after certain sales thresholds.<br><br>

You can read more about our account reviews here:<br>
https://dub.sh/polar-review

So no cause to be concerned. Typically, our reviews are completed within 24-48h.<br><br>

We'll reach out shortly in case we need any further information from you for our review.<br><br>
"""


class MaintainerAccountUnderReviewNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_under_review]
    payload: MaintainerAccountUnderReviewNotificationPayload


class MaintainerAccountReviewedNotificationPayload(NotificationPayloadBase):
    account_type: str

    @classmethod
    def subject(cls) -> str:
        return "Your Polar account review is now complete"

    @classmethod
    def body(cls) -> str:
        return """Hi,<br><br>

We are pleased to inform you that the review of your Polar account has been
successfully completed.<br><br>

We appreciate your patience throughout this process and are excited to grow
together!<br><br>
"""


class MaintainerAccountReviewedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_reviewed]
    payload: MaintainerAccountReviewedNotificationPayload


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

    @classmethod
    def subject(cls) -> str:
        return "Congrats! You have a new subscriber on {{tier_name}} ({{ formatted_price_amount if tier_price_amount else 'free' }}/{{tier_price_recurring_interval}})!"

    @classmethod
    def body(cls) -> str:
        return """Congratulations!<br><br>

{{subscriber_name}} is now subscribing to <strong>{{tier_name}}</strong> for {{ formatted_price_amount if tier_price_amount else "free" }}/{{tier_price_recurring_interval}}.<br><br>
"""


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

    @classmethod
    def subject(cls) -> str:
        return "Congrats! You've made a new sale ({{ formatted_price_amount }})!"

    @classmethod
    def body(cls) -> str:
        return """Congratulations!<br><br>

{{customer_name}} purchased <strong>{{product_name}}</strong> for {{formatted_price_amount}}.<br><br>
"""


class MaintainerNewProductSaleNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_new_product_sale]
    payload: MaintainerNewProductSaleNotificationPayload


class MaintainerCreateAccountNotificationPayload(NotificationPayloadBase):
    organization_name: str
    url: str

    @classmethod
    def subject(cls) -> str:
        return "Create a payout account for {{organization_name}} now to receive funds"

    @classmethod
    def body(cls) -> str:
        return """<h1>Hi,</h1>

<p>Now that you got your first payment to {{organization_name}}, you should create a payout account in order to receive your funds.</p>

<p>We support Stripe and Open Collective. This operation only takes a few minutes and allows you to receive your money immediately.</p>

<table class="body-action" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
        <td align="center">
            <!-- Border based button
https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                    <td align="center">
                        <a href="{{url}}" class="f-fallback button">Create my payout account</a>
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
            <p class="f-fallback sub"><a href="{{url}}">{{url}}</a></p>
        </td>
    </tr>
</table>
"""


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
