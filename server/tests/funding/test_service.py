import pytest

from polar.funding.service import ListByRowType
from polar.funding.service import funding as funding_service
from polar.models import Issue, Pledge
from polar.pledge.schemas import PledgeType
from polar.postgres import AsyncSession

from .conftest import IssuesPledgesFixture


def issue_row_assertions(
    row: ListByRowType, issue: Issue, pledges: list[Pledge]
) -> None:
    (
        issue_object,
        total,
        pay_upfront_total,
        pay_on_completion_total,
        pay_directly_total,
    ) = row._tuple()
    assert isinstance(issue, Issue)
    assert issue_object.id == issue.id
    assert len(issue.pledges) == len(pledges)

    assert total == sum([pledge.amount for pledge in pledges])
    assert pay_upfront_total == sum(
        [pledge.amount for pledge in pledges if pledge.type == PledgeType.pay_upfront]
    )
    assert pay_on_completion_total == sum(
        [
            pledge.amount
            for pledge in pledges
            if pledge.type == PledgeType.pay_on_completion
        ]
    )
    assert pay_directly_total == sum(
        [pledge.amount for pledge in pledges if pledge.type == PledgeType.pay_directly]
    )


@pytest.mark.asyncio
async def test_list_by(
    issues_pledges: IssuesPledgesFixture, session: AsyncSession
) -> None:
    results = await funding_service.list_by(session)

    for i, result in enumerate(results):
        issue, pledges = issues_pledges[i]
        issue_row_assertions(result, issue, pledges)
