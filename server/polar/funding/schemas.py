from datetime import datetime
from decimal import Decimal
from typing import Self, cast

from polar.currency.schemas import CurrencyAmount
from polar.issue.schemas import Issue
from polar.kit.schemas import Schema
from polar.models import Issue as IssueModel
from polar.pledge.schemas import Pledger, PledgeType

FundingResultType = tuple[
    IssueModel, Decimal, datetime | None, Decimal, Decimal, Decimal
]


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
    funding_goal: CurrencyAmount | None = None
    total: CurrencyAmount
    pledges_summaries: PledgesTypeSummaries

    @classmethod
    def from_list_by_result(cls, result: FundingResultType) -> Self:
        (
            issue,
            total,
            last_pledged_at,
            pay_upfront_total,
            pay_on_completion_total,
            pay_directly_total,
        ) = result

        pledgers: dict[PledgeType, list[Pledger]] = {
            pledge_type: [] for pledge_type in PledgeType
        }
        for pledge in issue.pledges:
            pledger = Pledger.from_pledge(pledge)
            if pledger:
                pledgers[cast(PledgeType, pledge.type)].append(pledger)

        pay_upfront_summary = PledgesSummary(
            total=CurrencyAmount(currency="USD", amount=int(pay_upfront_total)),
            pledgers=pledgers[PledgeType.pay_upfront],
        )
        pay_on_completion_summary = PledgesSummary(
            total=CurrencyAmount(currency="USD", amount=int(pay_on_completion_total)),
            pledgers=pledgers[PledgeType.pay_on_completion],
        )
        pay_directly_summary = PledgesSummary(
            total=CurrencyAmount(currency="USD", amount=int(pay_directly_total)),
            pledgers=pledgers[PledgeType.pay_directly],
        )

        return cls(
            issue=Issue.from_db(issue),
            funding_goal=CurrencyAmount(currency="USD", amount=issue.funding_goal)
            if issue.funding_goal
            else None,
            total=CurrencyAmount(currency="USD", amount=int(total)),
            pledges_summaries=PledgesTypeSummaries(
                pay_upfront=pay_upfront_summary,
                pay_on_completion=pay_on_completion_summary,
                pay_directly=pay_directly_summary,
            ),
        )
