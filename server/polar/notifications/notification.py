from abc import ABC, abstractmethod
from dataclasses import dataclass
from jinja2.nativetypes import NativeEnvironment
from jinja2 import StrictUndefined

from polar.models.user import User
from pydantic import BaseModel, Extra


# @dataclass
class NotificationType(BaseModel):
    @abstractmethod
    def template(self) -> str:
        pass

    def render(
        self,
        user: User,
    ) -> str:
        m: dict[str, str] = vars(self)
        m["username"] = user.username

        template = self.template()

        env = NativeEnvironment(undefined=StrictUndefined)
        t = env.from_string(template)
        res = t.render(m)
        return res


# @dataclass
class MaintainerPledgeCreatedNotification(NotificationType):
    pledger_name: str
    pledge_amount: str
    issue_url: str
    issue_title: str

    def template(self) -> str:
        return """Hi {{username}},<br><br>

{{pledger_name}} has pledged ${{pledge_amount}} to <a href="{{issue_url}}">{{issue_title}}</a>.
"""  # noqa: E501


# @dataclass
class MaintainerPledgePendingNotification(NotificationType):
    pledge_amount: str
    issue_url: str
    issue_title: str

    def template(self) -> str:
        return """Hi {{username}},<br><br>

<a href="{{issue_url}}">{{issue_title}}</a> is now closed, and had a total of ${{pledge_amount}} in pledges!<br><br>

The pledges are now in a 14 day review window, after which they will be paid out to your Stripe account.<br><br>

If you don't have a Stripe account setup, now is a good time to set one up.<br><br>
"""  # noqa: E501


# @dataclass
class MaintainerPledgePaidNotification(NotificationType):
    pledge_amount: str
    paid_out_amount: str
    issue_url: str
    issue_title: str

    def template(self) -> str:
        return """Hi {{username}},<br><br>

${{paid_out_amount}} from the pledges to <a href="{{issue_url}}">{{issue_title}}</a> has now been paid to connected Stripe account.
"""  # noqa: E501


# @dataclass
class PledgerPledgePendingNotification(NotificationType):
    pledge_amount: str
    paid_out_amount: str
    issue_url: str
    issue_title: str
    repo_owner: str

    def template(self) -> str:
        return """Hi {{username}},<br><br>

The issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed is now solved, and your pledge (${{pledge_amount}}) will soon be paid out to {{repo_owner}}.<br><br>

If the issue is not solved, dispute the pledge within 14 days from the <a href="https://dashboard.polar/sh">Polar</a> dashboard, or by replying to this email.

Thanks,
Polar and {{repo_owner}}!
"""  # noqa: E501
