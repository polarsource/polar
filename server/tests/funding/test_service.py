import uuid

import pytest

from polar.authz.service import Anonymous
from polar.funding.schemas import FundingResultType
from polar.funding.service import ListFundingSortBy
from polar.funding.service import funding as funding_service
from polar.kit.pagination import PaginationParams
from polar.models import Issue, Organization, Pledge, User, UserOrganization
from polar.pledge.schemas import PledgeState, PledgeType
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import create_repository, create_user

from .conftest import IssuesPledgesFixture, create_issues_pledges


def issue_row_assertions(
    result: FundingResultType, issue: Issue, pledges: list[Pledge]
) -> None:
    (
        issue_object,
        total,
        pay_upfront_total,
        pay_on_completion_total,
        pay_directly_total,
    ) = result
    assert isinstance(issue, Issue)
    assert issue_object.id == issue.id

    active_pledges = [
        pledge for pledge in pledges if pledge.state in PledgeState.active_states()
    ]
    assert len(issue.pledges) == len(active_pledges)

    assert total == sum([pledge.amount for pledge in active_pledges])
    assert pay_upfront_total == sum(
        [
            pledge.amount
            for pledge in active_pledges
            if pledge.type == PledgeType.pay_upfront
        ]
    )
    assert pay_on_completion_total == sum(
        [
            pledge.amount
            for pledge in active_pledges
            if pledge.type == PledgeType.pay_on_completion
        ]
    )
    assert pay_directly_total == sum(
        [
            pledge.amount
            for pledge in active_pledges
            if pledge.type == PledgeType.pay_directly
        ]
    )


@pytest.mark.asyncio
class TestListBy:
    async def test_without_option(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        results, count = await funding_service.list_by(
            session, Anonymous(), pagination=PaginationParams(1, 10)
        )

        assert count == len(issues_pledges)
        assert len(results) > 0
        for i, result in enumerate(results):
            issue, pledges = issues_pledges[i]
            issue_row_assertions(result, issue, pledges)

    async def test_sorting_newest(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        results, _ = await funding_service.list_by(
            session,
            Anonymous(),
            sorting=[ListFundingSortBy.newest],
            pagination=PaginationParams(1, 10),
        )

        assert results[0][0].id == issues_pledges[-1][0].id

    async def test_sorting_most_funded(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        results, _ = await funding_service.list_by(
            session,
            Anonymous(),
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(1, 10),
        )

        assert results[0][0].id == issues_pledges[0][0].id

    async def test_private_repository(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,  # makes User a member of Organization
    ) -> None:
        private_repository = await create_repository(
            session, organization, is_private=True
        )
        issues_pledges = await create_issues_pledges(
            session, organization, private_repository
        )

        results, count = await funding_service.list_by(
            session,
            Anonymous(),
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(1, 10),
        )

        assert count == 0
        assert len(results) == 0

        results, count = await funding_service.list_by(
            session,
            user,
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(1, 10),
        )

        assert count == len(issues_pledges)
        assert len(results) == len(issues_pledges)

    async def test_multiple_users_organization(
        self,
        issues_pledges: IssuesPledgesFixture,
        user: User,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        user2 = await create_user(session)
        await UserOrganization(
            user_id=user2.id,
            organization_id=organization.id,
        ).save(
            session=session,
        )
        user3 = await create_user(session)
        await UserOrganization(
            user_id=user3.id,
            organization_id=organization.id,
        ).save(
            session=session,
        )

        results, count = await funding_service.list_by(
            session, user, pagination=PaginationParams(1, 10), organization=organization
        )

        assert count == len(issues_pledges)
        assert len(results) > 0
        for i, result in enumerate(results):
            issue, pledges = issues_pledges[i]
            issue_row_assertions(result, issue, pledges)


@pytest.mark.asyncio
class TestGetByIssueId:
    async def test_not_existing_issue(self, session: AsyncSession) -> None:
        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=uuid.uuid4()
        )
        assert result is None

    async def test_public_issue(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        issue, pledges = issues_pledges[0]

        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=issue.id
        )

        assert result is not None
        issue_row_assertions(result, issue, pledges)

    async def test_private_issue(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,  # makes User a member of Organization
    ) -> None:
        private_repository = await create_repository(
            session, organization, is_private=True
        )
        issues_pledges = await create_issues_pledges(
            session, organization, private_repository
        )
        issue, pledges = issues_pledges[0]

        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=issue.id
        )

        assert result is None

        result = await funding_service.get_by_issue_id(session, user, issue_id=issue.id)

        assert result is not None
        issue_row_assertions(result, issue, pledges)
