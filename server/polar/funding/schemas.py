from polar.currency.schemas import CurrencyAmount
from polar.issue.schemas import Issue
from polar.kit.schemas import Schema
from polar.pledge.schemas import Pledger


# Public API
class PledgesSummary(Schema):
    total: CurrencyAmount
    pledgers: list[Pledger]


class PledgesTypeSummaries(Schema):
    pay_upfront: PledgesSummary
    pay_on_completion: PledgesSummary
    pay_directly: PledgesSummary


class IssueFunding(Schema):
    issue: Issue
    total: CurrencyAmount
    funding_goal: CurrencyAmount | None = None
