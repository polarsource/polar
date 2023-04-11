import unittest
from unittest.mock import ANY
import uuid
import pytest
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.models.user import User
from polar.notifications.service import PartialNotification, notifications
from polar.notifications.schemas import NotificationType
from polar.notifications.tasks.email import (
    MetadataMaintainerPledgeCreated,
    MetadataPledgedIssueBranchCreated,
    MetadataPledgedIssuePullRequestCreated,
    MetadataPledgedIssuePullRequestMerged,
    render_email,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_maintainer_pledge_created_metadata(
    session: AsyncSession,
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    issue: Issue,
    user: User,
    pledge_as_org: Pledge,
) -> None:
    res = await notifications.create_payload(
        session,
        issue,
        NotificationType.issue_pledge_created,
        notif=PartialNotification(
            pledge_id=pledge_as_org.id,
        ),
    )

    assert res is not None
    assert res == MetadataMaintainerPledgeCreated(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        pledge_amount="123.45",
    )

    # render it
    rendered = render_email(user, NotificationType.issue_pledge_created, res)
    assert (
        rendered
        == """Hi foobar,

pledging_org has pledged $123.45 to <a href="https://github.com/testorg/testrepo/issues/123">issue title</a>."""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_pull_request_created(
    session: AsyncSession,
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    issue: Issue,
    user: User,
    pledge_as_org: Pledge,
    pull_request: PullRequest,
) -> None:
    res = await notifications.create_payload(
        session,
        issue,
        NotificationType.issue_pledged_pull_request_created,
        notif=PartialNotification(
            pledge_id=pledge_as_org.id,
            pull_request_id=pull_request.id,
        ),
    )

    assert res is not None
    assert res == MetadataPledgedIssuePullRequestCreated(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        pull_request_url="https://github.com/testorg/testrepo/pull/5555",
        pull_request_title="PR Title",
        pull_request_creator_username="pr_creator_login",
        repo_owner="testorg",
        repo_name="testrepo",
    )

    # render it
    rendered = render_email(
        user, NotificationType.issue_pledged_pull_request_created, res
    )
    assert (
        rendered
        == """Hi foobar,

pr_creator_login just opened a <a href="https://github.com/testorg/testrepo/pull/5555">pull request</a> to testorg/testrepo that solves
the issue <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed!"""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_pull_request_merged(
    session: AsyncSession,
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    issue: Issue,
    user: User,
    pledge_as_org: Pledge,
    pull_request: PullRequest,
) -> None:
    res = await notifications.create_payload(
        session,
        issue,
        NotificationType.issue_pledged_pull_request_merged,
        notif=PartialNotification(
            pledge_id=pledge_as_org.id,
            pull_request_id=pull_request.id,
        ),
    )

    assert res is not None
    assert res == MetadataPledgedIssuePullRequestMerged(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        pull_request_url="https://github.com/testorg/testrepo/pull/5555",
        pull_request_title="PR Title",
        pull_request_creator_username="pr_creator_login",
        repo_owner="testorg",
        repo_name="testrepo",
    )

    # render it
    rendered = render_email(
        user, NotificationType.issue_pledged_pull_request_merged, res
    )
    assert (
        rendered
        == """Hi foobar,

pr_creator_login just merged a <a href="https://github.com/testorg/testrepo/pull/5555">pull request</a> to testorg/testrepo that solves
the issue <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed!

The money will soon be paid out to testorg."""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_branch_created(
    user: User,
) -> None:
    # render email, payload generation is tested elsewhere
    rendered = render_email(
        user,
        NotificationType.issue_pledged_branch_created,
        MetadataPledgedIssueBranchCreated(
            issue_url="https://github.com/testorg/testrepo/issues/123",
            issue_title="issue title",
            branch_creator_username="happy_coder",
            commit_link="https://github.com/testorg/testrepo/commit/abc123",
        ),
    )

    assert (
        rendered
        == """Hi foobar,

Polar has detected that happy_coder has started to work on a fix to <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed."""  # noqa: E501
    )
