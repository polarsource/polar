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
from polar.notifications.schemas import (
    IssuePledgeCreated,
    IssuePledgedBranchCreated,
    IssuePledgedPullRequestCreated,
    IssuePledgedPullRequestMerged,
    NotificationType,
)
from polar.notifications.tasks.email import (
    render_email,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_maintainer_pledge_created_metadata(
    session: AsyncSession,
    predictable_organization: Organization,
    predictable_pledging_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    predictable_user: User,
    predictable_pledge: Pledge,
) -> None:
    res = await notifications.create_payload(
        session,
        predictable_issue,
        NotificationType.issue_pledge_created,
        notif=PartialNotification(
            pledge_id=predictable_pledge.id,
        ),
    )

    assert res is not None
    assert res == IssuePledgeCreated(
        pledger_name="pledging_org",
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pledge_amount="123.45",
    )

    # render it
    rendered = render_email(
        predictable_user, NotificationType.issue_pledge_created, res
    )
    assert (
        rendered
        == """Hi foobar,<br><br>

pledging_org has pledged $123.45 to <a href="https://github.com/testorg/testrepo/issues/123">issue title</a>."""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_pull_request_created(
    session: AsyncSession,
    predictable_organization: Organization,
    predictable_pledging_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    predictable_user: User,
    predictable_pledge: Pledge,
    predictable_pull_request: PullRequest,
) -> None:
    res = await notifications.create_payload(
        session,
        predictable_issue,
        NotificationType.issue_pledged_pull_request_created,
        notif=PartialNotification(
            pledge_id=predictable_pledge.id,
            pull_request_id=predictable_pull_request.id,
        ),
    )

    assert res is not None
    assert res == IssuePledgedPullRequestCreated(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pull_request_url="https://github.com/testorg/testrepo/pull/5555",
        pull_request_title="PR Title",
        pull_request_number=5555,
        pull_request_creator_username="pr_creator_login",
        repo_owner="testorg",
        repo_name="testrepo",
    )

    # render it
    rendered = render_email(
        predictable_user, NotificationType.issue_pledged_pull_request_created, res
    )
    assert (
        rendered
        == """Hi foobar,<br><br>

pr_creator_login just opened a <a href="https://github.com/testorg/testrepo/pull/5555">pull request</a> to testorg/testrepo that solves
the issue <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed!"""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_pull_request_merged(
    session: AsyncSession,
    predictable_organization: Organization,
    predictable_pledging_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    predictable_user: User,
    predictable_pledge: Pledge,
    predictable_pull_request: PullRequest,
) -> None:
    res = await notifications.create_payload(
        session,
        predictable_issue,
        NotificationType.issue_pledged_pull_request_merged,
        notif=PartialNotification(
            pledge_id=predictable_pledge.id,
            pull_request_id=predictable_pull_request.id,
        ),
    )

    assert res is not None
    assert res == IssuePledgedPullRequestMerged(
        issue_url="https://github.com/testorg/testrepo/issues/123",
        issue_title="issue title",
        issue_number=123,
        pull_request_url="https://github.com/testorg/testrepo/pull/5555",
        pull_request_title="PR Title",
        pull_request_number=5555,
        pull_request_creator_username="pr_creator_login",
        repo_owner="testorg",
        repo_name="testrepo",
    )

    # render it
    rendered = render_email(
        predictable_user, NotificationType.issue_pledged_pull_request_merged, res
    )
    assert (
        rendered
        == """Hi foobar,<br><br>

pr_creator_login just merged a <a href="https://github.com/testorg/testrepo/pull/5555">pull request</a> to testorg/testrepo that solves
the issue <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed!<br><br>

The money will soon be paid out to testorg.<br><br>

If the issue is not solved, dispute the pledge within 14 days from the <a href="https://dashboard.polar/sh">Polar</a> dashboard, or by replying to this email."""  # noqa: E501
    )


@pytest.mark.asyncio
async def test_pledger_branch_created(
    predictable_user: User,
) -> None:
    # render email, payload generation is tested elsewhere
    rendered = render_email(
        predictable_user,
        NotificationType.issue_pledged_branch_created,
        IssuePledgedBranchCreated(
            issue_url="https://github.com/testorg/testrepo/issues/123",
            issue_title="issue title",
            issue_number=123,
            branch_creator_username="happy_coder",
            commit_link="https://github.com/testorg/testrepo/commit/abc123",
        ),
    )

    assert (
        rendered
        == """Hi foobar,<br><br>

Polar has detected that happy_coder has started to work on a fix to <a href="https://github.com/testorg/testrepo/issues/123">issue title</a> that you've backed."""  # noqa: E501
    )
