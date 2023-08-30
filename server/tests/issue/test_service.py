import secrets
import uuid
from datetime import datetime

import pytest

from polar.dashboard.schemas import IssueListType, IssueSortBy, IssueStatus
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.issue.service import issue as issue_service
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.issue_dependency import IssueDependency
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession
from tests import fixtures
from tests.fixtures import predictable_objects, random_objects


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_sorting(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
) -> None:
    # create testdata
    issue_1 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_1",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 10),
        issue_modified_at=datetime(2023, 1, 10),
    )

    issue_2 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_2",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 11),
        issue_modified_at=datetime(2023, 1, 11),
        positive_reactions_count=3,
        total_engagement_count=3,
    )

    issue_3 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_3",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 5),
        issue_modified_at=datetime(2023, 1, 15),
        positive_reactions_count=2,
        total_engagement_count=10,
    )

    issue_4 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_4",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 2, 1),
        issue_modified_at=datetime(2023, 2, 1),
        positive_reactions_count=1,
        pledged_amount_sum=5000,
    )

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
    )

    assert count == 4
    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_2", "issue_1", "issue_3"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.recently_updated,
    )

    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_3", "issue_2", "issue_1"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.least_recently_updated,
    )

    names = [i.title for i in issues]
    assert names == ["issue_1", "issue_2", "issue_3", "issue_4"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.most_positive_reactions,
    )

    names = [i.title for i in issues]
    assert names == [
        "issue_2",
        "issue_3",
        "issue_4",
        "issue_1",
    ]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.issues_default,
    )

    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_3", "issue_2", "issue_1"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.most_engagement,
    )

    names = [i.title for i in issues]
    assert names == ["issue_3", "issue_2", "issue_4", "issue_1"]


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_filter_triaged(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
) -> None:
    ghuser = github.rest.SimpleUser(
        login="birkjernstrom",
        id=281715,
        node_id="MDQ6VXNlcjI4MTcxNQ==",
        avatar_url="https://avatars.githubusercontent.com/u/281715?v=4",
        gravatar_id="",
        url="https://api.github.com/users/birkjernstrom",
        html_url="https://github.com/birkjernstrom",
        followers_url="https://api.github.com/users/birkjernstrom/followers",
        following_url="https://api.github.com/users/birkjernstrom/following{/other_user}",
        gists_url="https://api.github.com/users/birkjernstrom/gists{/gist_id}",
        starred_url="https://api.github.com/users/birkjernstrom/starred{/owner}{/repo}",
        subscriptions_url="https://api.github.com/users/birkjernstrom/subscriptions",
        organizations_url="https://api.github.com/users/birkjernstrom/orgs",
        repos_url="https://api.github.com/users/birkjernstrom/repos",
        events_url="https://api.github.com/users/birkjernstrom/events{/privacy}",
        received_events_url="https://api.github.com/users/birkjernstrom/received_events",
        type="User",
        site_admin=False,
    )

    # create testdata
    issue_1 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_1_triaged",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 10),
        issue_modified_at=datetime(2023, 1, 10),
        assignee=github.jsonify(ghuser),
        assignees=github.jsonify([ghuser]),
    )

    issue_2 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_2_backlog",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 11),
        issue_modified_at=datetime(2023, 1, 11),
        assignee=None,
        assignees=None,
    )

    issue_3 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_3_backlog",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 5),
        issue_modified_at=datetime(2023, 1, 15),
        assignee=None,
        assignees=None,
    )

    issue_4 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_4_closed",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="closed",
        issue_created_at=datetime(2023, 1, 16),
        issue_modified_at=datetime(2023, 1, 16),
        issue_closed_at=datetime(2023, 1, 16),
        assignee=None,
        assignees=None,
    )

    issue_5 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_5_pull_request",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 17),
        issue_modified_at=datetime(2023, 1, 17),
        assignee=None,
        assignees=None,
        issue_has_pull_request_relationship=True,
    )

    issue_6 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_6_closed_with_pr",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="closed",
        issue_created_at=datetime(2023, 1, 17),
        issue_modified_at=datetime(2023, 1, 17),
        issue_closed_at=datetime(2023, 1, 17),
        assignee=None,
        assignees=None,
        issue_has_pull_request_relationship=True,
    )

    issue_7 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_7_pull_request_with_in_progress",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 18),
        issue_modified_at=datetime(2023, 1, 18),
        assignee=None,
        assignees=None,
        issue_has_pull_request_relationship=True,
        issue_has_in_progress_relationship=True,
    )

    issue_8 = await Issue.create(
        session=session,
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
        title="issue_8_in_progress",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime(2023, 1, 19),
        issue_modified_at=datetime(2023, 1, 19),
        assignee=github.jsonify(ghuser),  # also assigned / triaged
        assignees=github.jsonify([ghuser]),
        issue_has_in_progress_relationship=True,
    )

    # backlog or triaged

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.backlog, IssueStatus.triaged],
    )

    assert count == 3
    names = [i.title for i in issues]
    assert names == ["issue_2_backlog", "issue_1_triaged", "issue_3_backlog"]

    # triaged

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.triaged],
    )

    assert count == 1
    names = [i.title for i in issues]
    assert names == [
        "issue_1_triaged",
    ]

    # in progress

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.in_progress],
    )

    names = [i.title for i in issues]
    assert names == [
        "issue_8_in_progress",
    ]
    assert count == 1

    # pull_request

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.pull_request],
    )

    names = [i.title for i in issues]
    assert names == [
        "issue_7_pull_request_with_in_progress",
        "issue_5_pull_request",
    ]
    assert count == 2

    # closed

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.closed],
    )

    names = [i.title for i in issues]
    assert names == [
        "issue_6_closed_with_pr",
        "issue_4_closed",
    ]
    assert count == 2

    # backlog

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.issues,
        sort_by=IssueSortBy.newest,
        include_statuses=[IssueStatus.backlog],
    )

    assert count == 2
    names = [i.title for i in issues]
    assert names == ["issue_2_backlog", "issue_3_backlog"]


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_dependencies_pledge(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
    user: User,
) -> None:
    # Third party issue

    third_party_org = await random_objects.create_organization(session)
    third_party_repo = await random_objects.create_repository(session, third_party_org)
    third_party_issue = await random_objects.create_issue(
        session, third_party_org, third_party_repo
    )
    third_party_issue.title = "pledged_towards"
    await third_party_issue.save(session)

    # this issue should not be in the result
    third_party_issue_2 = await random_objects.create_issue(
        session, third_party_org, third_party_repo
    )

    # the org and the user both have made pledges towards this issue
    third_party_issue_3 = await random_objects.create_issue(
        session, third_party_org, third_party_repo
    )
    third_party_issue_3.title = "double_pledge_towards"
    await third_party_issue_3.save(session)

    # Create pledge
    pledge = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        by_organization_id=organization.id,
        issue_id=third_party_issue.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2000,
        fee=200,
        state=PledgeState.created,
    )

    # Create other pledge to this issue (not by the org)
    pledge_other = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        issue_id=third_party_issue.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
    )

    # pledges to issue 3
    pledge_issue_3_user = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        issue_id=third_party_issue_3.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
        by_user_id=user.id,
    )
    pledge_issue_3_org = await Pledge.create(
        session=session,
        id=uuid.uuid4(),
        issue_id=third_party_issue_3.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
        by_organization_id=organization.id,
    )

    # TODO: test pledge statuses filter

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.dependencies,
        sort_by=IssueSortBy.newest,
        pledged_by_org=organization.id,
        pledged_by_user=user.id,
        load_pledges=True,
    )

    # assert count == 1
    names = [i.title for i in issues]
    assert names == ["double_pledge_towards", "pledged_towards"]

    # only the pledges by pledged_by_org/pledged_by_user should be included
    assert len(issues[0].pledges) == 2
    assert len(issues[1].pledges) == 1

    # Since our getter sorts by issues and not by pledges, we can get them in
    # different order based on the join. So we sort them by created_at here
    # to easily check against the same order creation in the test itself.
    sorted_pledges = sorted(issues[0].pledges, key=lambda p: p.created_at)

    # assert that backer metadata is joined
    assert sorted_pledges[0].id == pledge_issue_3_user.id
    assert sorted_pledges[0].by_user_id is not None
    assert sorted_pledges[0].user.username is not None

    assert sorted_pledges[1].id == pledge_issue_3_org.id
    assert sorted_pledges[1].by_organization_id is not None
    assert sorted_pledges[1].by_organization.name is not None


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_dependencies_pledge_state(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
    user: User,
) -> None:
    # Third party issue

    third_party_org = await random_objects.create_organization(session)
    third_party_repo = await random_objects.create_repository(session, third_party_org)

    for state in [
        PledgeState.initiated,  # does not appear in result
        PledgeState.created,
        PledgeState.disputed,
        PledgeState.refunded,  # does not appear in result
    ]:
        third_party_issue = await random_objects.create_issue(
            session, third_party_org, third_party_repo
        )
        third_party_issue.title = "pledged_towards_" + str(state)
        await third_party_issue.save(session)

        # Create pledge
        pledge = await Pledge.create(
            session=session,
            id=uuid.uuid4(),
            by_organization_id=organization.id,
            issue_id=third_party_issue.id,
            repository_id=third_party_repo.id,
            organization_id=third_party_org.id,
            amount=2000,
            fee=200,
            state=state,
        )

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.dependencies,
        sort_by=IssueSortBy.newest,
        pledged_by_org=organization.id,
        pledged_by_user=user.id,
        load_pledges=True,
    )

    # assert count == 1
    names = [i.title for i in issues]
    assert names == [
        "pledged_towards_PledgeState.disputed",
        "pledged_towards_PledgeState.created",
    ]


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_dependencies_dependency(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
    issue: Issue,
    user: User,
) -> None:
    # Third party issue

    third_party_org = await random_objects.create_organization(session)
    third_party_repo = await random_objects.create_repository(session, third_party_org)
    third_party_issue = await random_objects.create_issue(
        session, third_party_org, third_party_repo
    )
    third_party_issue.title = "is_a_dependency"
    await third_party_issue.save(session)

    # Create dependency
    dep = await IssueDependency.create(
        session=session,
        organization_id=organization.id,
        repository_id=repository.id,
        dependent_issue_id=issue.id,
        dependency_issue_id=third_party_issue.id,
    )

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        issue_list_type=IssueListType.dependencies,
        sort_by=IssueSortBy.newest,
        pledged_by_org=organization.id,
        pledged_by_user=user.id,
        load_pledges=True,
    )

    # assert count == 1
    names = [i.title for i in issues]
    assert names == ["is_a_dependency"]

    # only the pledges by pledged_by_org/pledged_by_user should be included
    # assert len(issues[0].issue.pledges_zegl) == 1


@pytest.mark.asyncio
async def test_list_by_github_milestone_number(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
    # issue: Issue,
    user: User,
) -> None:
    async def issue_with_milestone(number: int) -> Issue:
        issue = await random_objects.create_issue(
            session,
            organization,
            repository,
        )

        ms = github.rest.Milestone(
            url="http://example.com/",
            html_url="http://example.com/",
            labels_url="http://example.com/",
            id=1233333,
            node_id="xxxyyyyzzz",
            number=number,
            state="open",
            title="foo",
            description=None,
            creator=None,
            open_issues=4,
            closed_issues=8,
            created_at=utc_now(),
            updated_at=utc_now(),
            closed_at=None,
            due_on=None,
        )

        issue.title = f"issue_in_{number}"
        issue.milestone = github.jsonify(ms)
        await issue.save(session)
        return issue

    issue_1 = await issue_with_milestone(14)
    issue_2 = await issue_with_milestone(14)
    issue_3 = await issue_with_milestone(30)

    for milestone, expected in [
        (14, ["issue_in_14", "issue_in_14"]),
        (30, ["issue_in_30"]),
        (555, []),
    ]:
        (issues, count) = await issue_service.list_by_repository_type_and_status(
            session,
            repository_ids=[repository.id],
            issue_list_type=IssueListType.issues,
            sort_by=IssueSortBy.newest,
            github_milestone_number=milestone,
        )

        names = [i.title for i in issues]
        assert names == expected
