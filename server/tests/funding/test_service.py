import uuid

import pytest
from sqlalchemy import select

from polar.authz.service import Anonymous
from polar.funding.schemas import FundingResultType
from polar.funding.service import ListFundingSortBy
from polar.funding.service import funding as funding_service
from polar.issue.service import issue as issue_service
from polar.kit.pagination import PaginationParams
from polar.models import Issue, Organization, Pledge, User, UserOrganization
from polar.models.pledge import PledgeState, PledgeType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import (
    create_issue,
    create_pledge,
    create_repository,
    create_user,
)

from .conftest import IssuesPledgesFixture, create_issues_pledges


async def issue_row_assertions(
    session: AsyncSession,
    result: FundingResultType,
    issue: Issue,
    pledges: list[Pledge],
) -> None:
    (
        issue_object,
        total,
        last_pledged_at,
        pay_upfront_total,
        pay_on_completion_total,
        pay_directly_total,
    ) = result
    assert isinstance(issue, Issue)
    assert issue_object.id == issue.id

    active_pledges = [
        pledge for pledge in pledges if pledge.state in PledgeState.active_states()
    ]

    # load issue with relations
    issue_loaded = await issue_service.get_loaded(session, issue.id)
    assert issue_loaded
    issue = issue_loaded

    assert len(issue.pledges) == len(active_pledges)

    assert total == sum([pledge.amount for pledge in active_pledges])
    assert last_pledged_at == (
        max([pledge.created_at for pledge in active_pledges])
        if len(active_pledges) > 0
        else None
    )
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


async def run_calculate_sort_columns(session: AsyncSession) -> None:
    stmt = select(Issue.id)
    res = await session.execute(stmt)
    ids = res.scalars().unique().all()
    for id in ids:
        await pledge_service.set_issue_pledged_amount_sum(session, id)


@pytest.mark.asyncio
class TestListBy:
    async def test_without_option(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

        results, count = await funding_service.list_by(
            session, Anonymous(), pagination=PaginationParams(1, 10)
        )

        assert count == len(issues_pledges)
        assert len(results) > 0
        for i, result in enumerate(results):
            issue, pledges = issues_pledges[i]
            await issue_row_assertions(session, result, issue, pledges)

    async def test_sorting_newest(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

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
        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

        results, _ = await funding_service.list_by(
            session,
            Anonymous(),
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(1, 10),
        )

        assert results[0][0].id == issues_pledges[0][0].id

    async def test_sorting_most_recently_funded(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

        results, _ = await funding_service.list_by(
            session,
            Anonymous(),
            sorting=[ListFundingSortBy.most_recently_funded],
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

        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

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

    async def test_limit(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,  # makes User a member of Organization
    ) -> None:
        repository = await create_repository(
            session,
            organization,
            is_private=False,
        )

        issues = []

        # create 20 issues
        for n in range(20):
            issue = await create_issue(session, organization, repository)
            issues.append(issue)

        # add pledges
        for n in range(3):
            await create_pledge(
                session,
                organization,
                repository,
                issues[0],
                pledging_organization=organization,
                type=PledgeType.pay_upfront,
            )

        for n in range(3):
            await create_pledge(
                session,
                organization,
                repository,
                issues[4],
                pledging_organization=organization,
                type=PledgeType.pay_upfront,
            )

        # then
        await run_calculate_sort_columns(session)
        session.expunge_all()

        results, count = await funding_service.list_by(
            session,
            user,
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(1, 8),  # limit 8
        )

        assert 20 == count
        assert 8 == len(results)

        # second page
        results_page_2, count = await funding_service.list_by(
            session,
            user,
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(2, 8),  # limit 8
        )

        assert 20 == count
        assert 8 == len(results_page_2)

        # no overlap between pages
        first_ids = set([f[0].id for f in results])
        second_ids = set([f[0].id for f in results_page_2])
        assert 0 == len(first_ids.intersection(second_ids))

        # third page
        results_page_3, count = await funding_service.list_by(
            session,
            user,
            sorting=[ListFundingSortBy.most_funded],
            pagination=PaginationParams(3, 8),  # limit 8
        )

        assert 20 == count
        assert 4 == len(results_page_3)

    async def test_multiple_users_organization(
        self,
        issues_pledges: IssuesPledgesFixture,
        user: User,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await run_calculate_sort_columns(session)

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

        # then
        session.expunge_all()

        results, count = await funding_service.list_by(
            session, user, pagination=PaginationParams(1, 10), organization=organization
        )

        assert count == len(issues_pledges)
        assert len(results) > 0
        for i, result in enumerate(results):
            issue, pledges = issues_pledges[i]
            await issue_row_assertions(session, result, issue, pledges)

    async def test_query(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        titles = [
            "Bug during request",
            "Improvement of the API",
            "Documentation is wrong",
        ]
        for i, issue_pledge in enumerate(issues_pledges):
            issue_pledge[0].title = titles[i]
            session.add(issue_pledge[0])
        await session.commit()

        # then
        session.expunge_all()

        results, count = await funding_service.list_by(
            session,
            Anonymous(),
            pagination=PaginationParams(1, 10),
            query="documentation",
        )

        assert count == 1
        assert len(results) == 1
        issue, _ = issues_pledges[2]
        assert results[0][0].id == issue.id


@pytest.mark.asyncio
class TestGetByIssueId:
    async def test_not_existing_issue(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()
        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=uuid.uuid4()
        )
        assert result is None

    async def test_public_issue(
        self, issues_pledges: IssuesPledgesFixture, session: AsyncSession
    ) -> None:
        issue, pledges = issues_pledges[0]

        # then
        session.expunge_all()

        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=issue.id
        )

        assert result is not None
        await issue_row_assertions(session, result, issue, pledges)

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

        # then
        session.expunge_all()

        result = await funding_service.get_by_issue_id(
            session, Anonymous(), issue_id=issue.id
        )

        assert result is None

        result = await funding_service.get_by_issue_id(session, user, issue_id=issue.id)

        assert result is not None
        await issue_row_assertions(session, result, issue, pledges)
