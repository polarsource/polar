from abc import abstractmethod
from uuid import UUID

from pydantic import BaseModel

from polar.email.renderer import get_email_renderer
from polar.models.user import User
from polar.pledge.schemas import PledgeType


class NotificationBase(BaseModel):
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


class MaintainerPledgeCreatedNotification(NotificationBase):
    pledger_name: str | None
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_stripe_account: bool
    pledge_id: UUID | None = None  # Added 2023-06-26
    pledge_type: PledgeType | None  # Added 2023-10-17

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
The pledge to be paid on completion. Once you've completed the issue, we'll send an invoice to the pledger. As soon as it's paid we'll transfer the money to you.<br><br>.br><br>
{% endif %}

We'll notify you about the next steps when {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}} is completed.

{% if not maintainer_has_stripe_account -%}
<br><br>Create a Stripe account with Polar today to avoid any delay with future transfers.<br>
<a href="https://polar.sh/maintainer/{{issue_org_name}}/finance">polar.sh/maintainer/{{issue_org_name}}/finance</a>
{% endif -%}
"""  # noqa: E501


# No longer sent as of 2023-08-22.
# Replaced by MaintainerPledgedIssueConfirmationPendingNotification
class MaintainerPledgeConfirmationPendingNotification(NotificationBase):
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


class MaintainerPledgedIssueConfirmationPendingNotification(NotificationBase):
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


# No longer sent as of 2023-08-22.
# Replaced by MaintainerPledgedIssuePendingNotification
class MaintainerPledgePendingNotification(NotificationBase):
    pledger_name: str
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    maintainer_has_stripe_account: bool
    pledge_id: UUID | None  # Added 2023-06-26

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


# Sent to mainatiners after marking an issue as completed, and setting the rewards.
class MaintainerPledgedIssuePendingNotification(NotificationBase):
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


# No longer sent as of 2023-08-16
class MaintainerPledgePaidNotification(NotificationBase):
    paid_out_amount: str
    issue_url: str
    issue_title: str
    issue_org_name: str
    issue_repo_name: str
    issue_number: int
    pledge_id: UUID | None  # Added 2023-06-26

    def subject(self) -> str:
        return "${{paid_out_amount}} transferred for {{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}"  # noqa: E501

    def body(self) -> str:
        return """Hi,<br><br>

We&apos;ve now transferred ${{paid_out_amount}} in approved pledges for your efforts on <a href="{{issue_url}}">{{issue_org_name}}/{{issue_repo_name}}#{{issue_number}}</a>. It will arrive to your Stripe account that you have connected with Polar.<br><br>

Don&apos;t hesitate to reply here with any questions you might have.<br><br>

Best,<br>
Polar

"""  # noqa: E501


class RewardPaidNotification(NotificationBase):
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


class PledgerPledgePendingNotification(NotificationBase):
    pledge_amount: str
    issue_url: str
    issue_title: str
    issue_number: int
    issue_org_name: str
    issue_repo_name: str
    pledge_date: str
    pledge_id: UUID | None  # Added 2023-06-26
    pledge_type: PledgeType | None  # Added 2023-11-27

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
