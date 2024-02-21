from abc import abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import UUID4, BaseModel, Discriminator, Field

from polar.email.renderer import get_email_renderer
from polar.kit.money import get_cents_in_dollar_string
from polar.kit.schemas import Schema
from polar.models.pledge import PledgeType
from polar.models.user import User


class NotificationType(StrEnum):
    maintainer_pledge_created = "MaintainerPledgeCreatedNotification"
    maintainer_pledge_confirmation_pending = (
        "MaintainerPledgeConfirmationPendingNotification"
    )
    maintainer_pledged_issue_confirmation_pending = (
        "MaintainerPledgedIssueConfirmationPendingNotification"
    )
    maintainer_pledge_pending = "MaintainerPledgePendingNotification"
    maintainer_pledged_issue_pending = "MaintainerPledgedIssuePendingNotification"
    maintainer_pledge_paid = "MaintainerPledgePaidNotification"
    reward_paid = "RewardPaidNotification"
    pledger_pledge_pending = "PledgerPledgePendingNotification"
    team_admin_member_pledged = "TeamAdminMemberPledgedNotification"
    maintainer_account_under_review = "MaintainerAccountUnderReviewNotification"
    maintainer_account_reviewed = "MaintainerAccountReviewedNotification"
    maintainer_new_paid_subscription = "MaintainerNewPaidSubscriptionNotification"
    subscription_benefit_precondition_error = (
        "SubscriptionBenefitPreconditionErrorNotification"
    )
    maintainer_create_account = "MaintainerCreateAccountNotification"


class NotificationPayloadBase(BaseModel):
    @abstractmethod
    def subject(self) -> str:
        pass

    @abstractmethod
    def body(self) -> str:
        pass

    def render(
        self,
        user: User,
    ) -> tuple[str, str]:
        m: dict[str, str] = vars(self)
        m["username"] = user.username

        email_renderer = get_email_renderer()
        return email_renderer.render_from_string(self.subject(), self.body(), m)


class NotificationBase(Schema):
    id: UUID4
    created_at: datetime
    type: NotificationType


class MaintainerPledgeCreatedNotificationPayload(NotificationPayloadBase):
    pledger_name: str | None = None
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_stripe_account: bool
    pledge_id: UUID | None = None  # Added 2023-06-26
    pledge_type: PledgeType | None = None  # Added 2023-10-17

    def subject(self) -> str:
        return "Received ${{pledge_amount}} in funding for {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

{% if pledger_name %}
Great news! You received <strong>${{pledge_amount}}</strong> in funding from {{pledger_name}} for:
{% else %}
Great news! You received <strong>${{pledge_amount}}</strong> in funding for:
{% endif -%}

<a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} - {{issue_title}}</a>.<br><br>

{% if pledge_type == "pay_upfront" %}
The funding has been paid upfront. Once you've completed the issue, the money will be paid out to after the 7 day dispute window.<br><br>
{% elif pledge_type == "pay_on_completion" %}
The pledge is due to be paid on completion. Once you've completed the issue, we'll send an invoice to the backer. As soon as it's paid we'll transfer the money to you.<br><br>
{% endif %}

We'll notify you about the next steps when {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed.

{% if not maintainer_has_stripe_account -%}
<br><br>Create a Stripe account with Polar today to avoid any delay with future transfers.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif -%}
"""  # noqa: E501


class MaintainerPledgeCreatedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledge_created]
    payload: MaintainerPledgeCreatedNotificationPayload


# No longer sent as of 2023-08-22.
# Replaced by MaintainerPledgedIssueConfirmationPendingNotification
class MaintainerPledgeConfirmationPendingNotificationPayload(NotificationPayloadBase):
    pledger_name: str
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_stripe_account: bool
    pledge_id: UUID | None = None  # Added 2023-06-26

    def subject(self) -> str:
        return "Please confirm that {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

Your backers have pledged ${{pledge_amount}} behind <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> which which has now been closed.<br><br>

Before you can receive the money, please verify that the issue is completed on <a href="https://polar.sh/maintainer/{{issue_org_name}}/issues">your Polar dashboard</a>.<br><br>

{% if not maintainer_has_stripe_account %}
Create a Stripe account with Polar today to ensure we can transfer the funds directly once the review period is completed.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif %}
"""  # noqa: E501


class MaintainerPledgeConfirmationPendingNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledge_confirmation_pending]
    payload: MaintainerPledgeConfirmationPendingNotificationPayload


class MaintainerPledgedIssueConfirmationPendingNotificationPayload(
    NotificationPayloadBase
):
    pledge_amount_sum: str
    issue_id: UUID
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_account: bool

    def subject(self) -> str:
        return "Please confirm that {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

Your backers funded <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> with ${{pledge_amount_sum}}, which has now been closed.<br><br>

Before you can receive your share, please verify that the issue is completed on <a href="https://polar.sh/maintainer/{{issue_org_name}}/issues">your Polar dashboard</a>.
When you're verifying the issue, you can also decide to split the rewards with other contributors.
<br><br>

After you've marked the issue as completed, we'll start our payment and payout process.
For backers that have paid upfront, we'll transfer the money to you as soon as the 7 day dispute window is over.
For backers that are paying by invoice on completion, we'll transfer the money as soon as the invoice has been paid.<br><br>

{% if not maintainer_has_account %}
Create a Stripe account with Polar today to ensure we can transfer the funds directly once the review period is completed.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif %}
"""  # noqa: E501


class MaintainerPledgedIssueConfirmationPendingNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledged_issue_confirmation_pending]
    payload: MaintainerPledgedIssueConfirmationPendingNotificationPayload


# No longer sent as of 2023-08-22.
# Replaced by MaintainerPledgedIssuePendingNotification
class MaintainerPledgePendingNotificationPayload(NotificationPayloadBase):
    pledger_name: str
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_stripe_account: bool
    pledge_id: UUID | None = None  # Added 2023-06-26

    def subject(self) -> str:
        return "You have ${{pledge_amount}} in pending pledges for {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}!"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

Your backers had pledged ${{pledge_amount}} behind <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> which has now been completed - awesome work!<br><br>

We&apos;ve notified the backers and unless we receive any disputes within the next 7 days it will be transferred to your Stripe account.<br><br>

{% if not maintainer_has_stripe_account %}
Create a Stripe account with Polar today to ensure we can transfer the funds directly once the review period is completed.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif %}
"""  # noqa: E501


class MaintainerPledgePendingNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledge_pending]
    payload: MaintainerPledgePendingNotificationPayload


# Sent to mainatiners after marking an issue as completed, and setting the rewards.
class MaintainerPledgedIssuePendingNotificationPayload(NotificationPayloadBase):
    pledge_amount_sum: str
    issue_id: UUID
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_account: bool

    def subject(self) -> str:
        return "Notified backers that {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

Thanks for confirming that <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> has been completed.<br<br>

We've now notified all of your backers, and will soon start paying out the rewards!<br<br>

If the backer have paid upfront, we'll transfer the money to you as soon as the 7 day dispute window is over. For backers that are paying by invoice on completion, we'll transfer the money as soon as the invoice has been paid.<br><br>

You can track the payment status over on <a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">your "Finance" page on Polar</a>.<br<br>

If you have any questions, please reach out to us and we'll help you.<br><br>

{% if not maintainer_has_account %}
Create a Stripe account with Polar today to ensure we can transfer the funds as soon as possible.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif %}
"""  # noqa: E501


class MaintainerPledgedIssuePendingNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledged_issue_pending]
    payload: MaintainerPledgedIssuePendingNotificationPayload


# No longer sent as of 2023-08-16
class MaintainerPledgePaidNotificationPayload(NotificationPayloadBase):
    paid_out_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    pledge_id: UUID | None = None  # Added 2023-06-26

    def subject(self) -> str:
        return "${{paid_out_amount}} transferred for {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

We&apos;ve now transferred ${{paid_out_amount}} in approved pledges for your efforts on <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a>. It will arrive to your Stripe account that you have connected with Polar.<br><br>

Don&apos;t hesitate to reply here with any questions you might have.<br><br>

Best,<br>
Polar

"""  # noqa: E501


class MaintainerPledgePaidNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_pledge_paid]
    payload: MaintainerPledgePaidNotificationPayload


class RewardPaidNotificationPayload(NotificationPayloadBase):
    paid_out_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    issue_id: UUID
    pledge_id: UUID

    def subject(self) -> str:
        return "${{paid_out_amount}} transferred for {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

We&apos;ve now transferred ${{paid_out_amount}} for your efforts on <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a>. It will arrive to the account that you'be connected to Polar.<br><br>

Don&apos;t hesitate to reply here with any questions you might have.<br><br>

Best,<br>
Polar

"""  # noqa: E501


class RewardPaidNotification(NotificationBase):
    type: Literal[NotificationType.reward_paid]
    payload: RewardPaidNotificationPayload


class PledgerPledgePendingNotificationPayload(NotificationPayloadBase):
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_number: int
    issue_org_name: str
    issue_repo_name: str
    pledge_date: str
    pledge_id: UUID | None = None  # Added 2023-06-26
    pledge_type: PledgeType | None = None  # Added 2023-11-27

    def subject(self) -> str:
        return "{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed"

    def body(self) -> str:
        return """Hi,<br><br>

Good news: <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> has been completed!<br><br>

{% if pledge_type == "pay_upfront" %}
You funded it with ${{pledge_amount}} on {{pledge_date}}. It will be rewarded to the creators in 7 days unless you file a dispute via email or the Polar dashboard before the dispute window ends.<br><br>
{% elif pledge_type == "pay_on_completion" %}
You made a ${{pledge_amount}} pledge behind it on {{pledge_date}}, to be paid on completion. We'll soon send you an invoice via Stripe, please keep an eye in your inbox.<br><br>
{% endif %}

Best,<br>
Polar
"""  # noqa: E501


class PledgerPledgePendingNotification(NotificationBase):
    type: Literal[NotificationType.pledger_pledge_pending]
    payload: PledgerPledgePendingNotificationPayload


class TeamAdminMemberPledgedNotificationPayload(NotificationPayloadBase):
    team_member_name: str
    team_name: str
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_number: int
    issue_org_name: str
    issue_repo_name: str
    pledge_id: UUID

    def subject(self) -> str:
        return "{{team_member_name}} pledged ${{pledge_amount}} to {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}"

    def body(self) -> str:
        return """Hi,<br><br>

{{team_member_name}} just made a ${{pledge_amount}} pledge towards <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a> on behalf of {{team_name}}.
"""  # noqa: E501


class TeamAdminMemberPledgedNotification(NotificationBase):
    type: Literal[NotificationType.team_admin_member_pledged]
    payload: TeamAdminMemberPledgedNotificationPayload


class MaintainerAccountUnderReviewNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your payout account is under review"

    def body(self) -> str:
        return f"""Hi,<br><br>

We wanted to inform you that your {self.account_type} account has reached a transaction threshold, and as part of our security measures, we are now conducting a review.<br><br>

During this brief evaluation period, payouts to your account won't be possible. We assure you that this is a routine procedure to ensure the safety and security of your account.<br><br>

Our team is working diligently to complete the review promptly. We appreciate your understanding and cooperation during this process. If there are any specific details or documents required for the review, our support team will reach out to you directly.<br><br>
"""  # noqa: E501


class MaintainerAccountUnderReviewNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_under_review]
    payload: MaintainerAccountUnderReviewNotificationPayload


class MaintainerAccountReviewedNotificationPayload(NotificationPayloadBase):
    account_type: str

    def subject(self) -> str:
        return "Your payout account is now reviewed and active"

    def body(self) -> str:
        return f"""Hi,<br><br>

We are pleased to inform you that the review of your {self.account_type} account has been successfully completed, and we appreciate your patience throughout this process.<br><br>

Your payout account is now fully active, and money transfers are now possible without any restrictions. We apologize for any inconvenience caused during the brief review period and want to assure you that it was conducted to ensure the security of your account.<br><br>
"""  # noqa: E501


class MaintainerAccountReviewedNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_account_reviewed]
    payload: MaintainerAccountReviewedNotificationPayload


class MaintainerNewPaidSubscriptionNotificationPayload(NotificationPayloadBase):
    subscriber_name: str
    tier_name: str
    tier_price_amount: int
    tier_organization_name: str

    def subject(self) -> str:
        return f"{self.subscriber_name} is now subscribing to {self.tier_name} (${get_cents_in_dollar_string(self.tier_price_amount)})"

    def body(self) -> str:
        return f"""Congratulations!<br><br>

{self.subscriber_name} is now subscribing to <strong>{self.tier_name}</strong> for ${get_cents_in_dollar_string(self.tier_price_amount)}/month.<br><br>
"""  # noqa: E501


class MaintainerNewPaidSubscriptionNotification(NotificationBase):
    type: Literal[NotificationType.maintainer_new_paid_subscription]
    payload: MaintainerNewPaidSubscriptionNotificationPayload


class SubscriptionBenefitPreconditionErrorNotificationContextualPayload(BaseModel):
    extra_context: dict[str, Any] = Field(default_factory=dict)
    subject_template: str
    body_template: str


class SubscriptionBenefitPreconditionErrorNotificationPayload(
    NotificationPayloadBase,
    SubscriptionBenefitPreconditionErrorNotificationContextualPayload,
):
    subscription_id: UUID
    subscription_tier_name: str
    subscription_tier_id: UUID
    subscription_benefit_id: UUID
    subscription_benefit_description: str
    organization_name: str

    def subject(self) -> str:
        return self.subject_template.format(**self.model_dump())

    def body(self) -> str:
        return self.body_template.format(**self.model_dump())


class SubscriptionBenefitPreconditionErrorNotification(NotificationBase):
    type: Literal[NotificationType.subscription_benefit_precondition_error]
    payload: SubscriptionBenefitPreconditionErrorNotificationPayload


class MaintainerCreateAccountNotificationPayload(NotificationPayloadBase):
    organization_name: str
    url: str

    def subject(self) -> str:
        return (
            f"Create a payout account for {self.organization_name} now to receive funds"
        )

    def body(self) -> str:
        return f"""<h1>Hi,</h1>

<p>Now that you got your first paid subscribers on {self.organization_name}, you should create a payout account in order to receive your funds.</p>

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
    MaintainerPledgeCreatedNotificationPayload
    | MaintainerPledgeConfirmationPendingNotificationPayload
    | MaintainerPledgedIssueConfirmationPendingNotificationPayload
    | MaintainerPledgePendingNotificationPayload
    | MaintainerPledgedIssuePendingNotificationPayload
    | MaintainerPledgePaidNotificationPayload
    | RewardPaidNotificationPayload
    | PledgerPledgePendingNotificationPayload
    | TeamAdminMemberPledgedNotificationPayload
    | MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | SubscriptionBenefitPreconditionErrorNotificationPayload
    | MaintainerCreateAccountNotificationPayload
)

Notification = Annotated[
    MaintainerPledgeCreatedNotification
    | MaintainerPledgeConfirmationPendingNotification
    | MaintainerPledgedIssueConfirmationPendingNotification
    | MaintainerPledgePendingNotification
    | MaintainerPledgedIssuePendingNotification
    | MaintainerPledgePaidNotification
    | RewardPaidNotification
    | PledgerPledgePendingNotification
    | TeamAdminMemberPledgedNotification
    | MaintainerAccountUnderReviewNotification
    | MaintainerAccountReviewedNotification
    | MaintainerNewPaidSubscriptionNotification
    | SubscriptionBenefitPreconditionErrorNotification
    | MaintainerCreateAccountNotification,
    Discriminator(discriminator="type"),
]
