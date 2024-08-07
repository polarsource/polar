import pytest_asyncio

from polar.models import ExternalOrganization, Issue, Organization, Pledge, Repository
from polar.models.pledge import PledgeState, PledgeType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_issue, create_pledge

IssuesPledgesFixture = list[tuple[Issue, list[Pledge]]]


async def create_issues_pledges(
    save_fixture: SaveFixture,
    organization: Organization,
    external_organization: ExternalOrganization,
    repository: Repository,
) -> IssuesPledgesFixture:
    issue_1 = await create_issue(save_fixture, external_organization, repository)
    issue_1_pledges = [
        await create_pledge(
            save_fixture,
            external_organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_upfront,
        ),
        await create_pledge(
            save_fixture,
            external_organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_upfront,
        ),
        await create_pledge(
            save_fixture,
            external_organization,
            repository,
            issue_1,
            pledging_organization=organization,
            type=PledgeType.pay_on_completion,
        ),
    ]

    issue_2 = await create_issue(save_fixture, external_organization, repository)
    issue_2_pledges: list[Pledge] = []

    issue_3 = await create_issue(save_fixture, external_organization, repository)
    issue_3_pledges: list[Pledge] = [
        await create_pledge(
            save_fixture,
            external_organization,
            repository,
            issue_3,
            pledging_organization=organization,
            state=PledgeState.initiated,
            type=PledgeType.pay_upfront,
        ),
    ]

    return [
        (issue_1, issue_1_pledges),
        (issue_2, issue_2_pledges),
        (issue_3, issue_3_pledges),
    ]


@pytest_asyncio.fixture
async def issues_pledges(
    save_fixture: SaveFixture,
    external_organization_linked: ExternalOrganization,
    organization: Organization,
    public_repository_linked: Repository,
) -> IssuesPledgesFixture:
    return await create_issues_pledges(
        save_fixture,
        organization,
        external_organization_linked,
        public_repository_linked,
    )
