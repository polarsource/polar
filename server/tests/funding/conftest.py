import pytest_asyncio

from polar.models import Issue, Organization, Pledge, Repository
from polar.pledge.schemas import PledgeType
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import create_issue, create_pledge

IssuesPledgesFixture = list[tuple[Issue, list[Pledge]]]


@pytest_asyncio.fixture
async def issues_pledges(
    session: AsyncSession, organization: Organization, repository: Repository
) -> IssuesPledgesFixture:
    issue_1 = await create_issue(session, organization, repository)
    issue_1_pledges = [
        await create_pledge(
            session,
            organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_upfront,
        ),
        await create_pledge(
            session,
            organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_upfront,
        ),
        await create_pledge(
            session,
            organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_on_completion,
        ),
    ]

    issue_2 = await create_issue(session, organization, repository)
    issue_2_pledges: list[Pledge] = []

    return [
        (issue_1, issue_1_pledges),
        (issue_2, issue_2_pledges),
    ]
