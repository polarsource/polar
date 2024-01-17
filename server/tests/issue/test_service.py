import secrets
import uuid
from datetime import datetime

import pytest

from polar.dashboard.schemas import IssueSortBy
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.integrations.github import types
from polar.issue.service import issue as issue_service
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState
from polar.models.repository import Repository
from polar.models.user import User
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from tests.fixtures import random_objects


@pytest.mark.asyncio
async def test_list_by_repository_type_and_status_sorting(
    session: AsyncSession,
    repository: Repository,
    organization: Organization,
) -> None:
    # create testdata
    issue_1 = await Issue(
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
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    ).save(session)

    issue_2 = await Issue(
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
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    ).save(session)

    issue_3 = await Issue(
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
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    ).save(session)

    issue_4 = await Issue(
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
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    ).save(session)

    # then
    session.expunge_all()

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        sort_by=IssueSortBy.newest,
    )

    assert count == 4
    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_2", "issue_1", "issue_3"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        sort_by=IssueSortBy.recently_updated,
    )

    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_3", "issue_2", "issue_1"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        sort_by=IssueSortBy.least_recently_updated,
    )

    names = [i.title for i in issues]
    assert names == ["issue_1", "issue_2", "issue_3", "issue_4"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
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
        sort_by=IssueSortBy.issues_default,
    )

    names = [i.title for i in issues]
    assert names == ["issue_4", "issue_3", "issue_2", "issue_1"]

    (issues, _) = await issue_service.list_by_repository_type_and_status(
        session,
        repository_ids=[repository.id],
        sort_by=IssueSortBy.most_engagement,
    )

    names = [i.title for i in issues]
    assert names == ["issue_3", "issue_2", "issue_4", "issue_1"]


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
    pledge = await Pledge(
        id=uuid.uuid4(),
        by_organization_id=organization.id,
        issue_id=third_party_issue.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2000,
        fee=200,
        state=PledgeState.created,
    ).save(session)

    # Create other pledge to this issue (not by the org)
    pledge_other = await Pledge(
        id=uuid.uuid4(),
        issue_id=third_party_issue.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
    ).save(session)

    # pledges to issue 3
    pledge_issue_3_user = await Pledge(
        id=uuid.uuid4(),
        issue_id=third_party_issue_3.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
        by_user_id=user.id,
    ).save(session)

    pledge_issue_3_org = await Pledge(
        id=uuid.uuid4(),
        issue_id=third_party_issue_3.id,
        repository_id=third_party_repo.id,
        organization_id=third_party_org.id,
        amount=2100,
        fee=200,
        state=PledgeState.created,
        by_organization_id=organization.id,
    ).save(session)

    # then
    session.expunge_all()

    # TODO: test pledge statuses filter

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
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
    assert sorted_pledges[0].user is not None
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
        third_party_issue.title = "pledged_towards_" + state
        await third_party_issue.save(session)

        # Create pledge
        pledge = await Pledge(
            id=uuid.uuid4(),
            by_organization_id=organization.id,
            issue_id=third_party_issue.id,
            repository_id=third_party_repo.id,
            organization_id=third_party_org.id,
            amount=2000,
            fee=200,
            state=state,
        ).save(session)

    # then
    session.expunge_all()

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session,
        sort_by=IssueSortBy.newest,
        pledged_by_org=organization.id,
        pledged_by_user=user.id,
        load_pledges=True,
    )

    # assert count == 1
    names = [i.title for i in issues]
    assert names == ["pledged_towards_disputed", "pledged_towards_created"]


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

        ms = types.Milestone(
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

    # then
    session.expunge_all()

    for milestone, expected in [
        (14, ["issue_in_14", "issue_in_14"]),
        (30, ["issue_in_30"]),
        (555, []),
    ]:
        (issues, count) = await issue_service.list_by_repository_type_and_status(
            session,
            repository_ids=[repository.id],
            sort_by=IssueSortBy.newest,
            github_milestone_number=milestone,
        )

        names = [i.title for i in issues]
        assert names == expected


@pytest.mark.asyncio
async def test_transfer(
    session: AsyncSession,
    organization: Organization,
    pledging_organization: Organization,
) -> None:
    old_repository = await random_objects.create_repository(
        session, organization, is_private=False
    )
    old_issue = await random_objects.create_issue(session, organization, old_repository)
    old_issue.funding_goal = 10_000

    pledges = [
        await random_objects.create_pledge(
            session, organization, old_repository, old_issue, pledging_organization
        )
        for _ in range(2)
    ]

    new_repository = await random_objects.create_repository(
        session, organization, is_private=False
    )
    new_issue = await random_objects.create_issue(session, organization, new_repository)

    # then
    session.expunge_all()

    updated_new_issue = await issue_service.transfer(session, old_issue, new_issue)

    assert updated_new_issue.funding_goal == 10_000

    for pledge in pledges:
        updated_pledge = await pledge_service.get(session, pledge.id)
        assert updated_pledge is not None
        assert updated_pledge.organization_id == organization.id
        assert updated_pledge.repository_id == new_repository.id
        assert updated_pledge.issue_id == new_issue.id
