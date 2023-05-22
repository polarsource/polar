from datetime import datetime
from unittest.mock import ANY, call
import pytest
from polar.enums import Platforms
from polar.models.issue import Issue
from polar.models.issue_reference import (
    ExternalGitHubCommitReference,
    IssueReference,
    ReferenceType,
)
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.notifications.schemas import (
    IssuePledgedBranchCreated,
    MaintainerIssueBranchCreated,
    NotificationType,
)
from polar.notifications.service import (
    NotificationsService,
    PartialNotification,
    notifications,
)
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession
from pytest_mock import MockerFixture
from fastapi.encoders import jsonable_encoder
from polar.pledge.service import pledge as pledge_service


@pytest.mark.asyncio
async def test_pledged_issue_pull_request_created(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
    pledging_organization: Organization,
) -> None:
    m = mocker.spy(
        notifications,
        "send_to_org",
    )

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=pledging_organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-3",
    )

    # Update to created
    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id",
    )

    # Create pull request
    pr = await PullRequest.create(
        session=session,
        platform=Platforms.github,
        number=123,
        external_id=1234,
        repository_id=repository.id,
        organization_id=organization.id,
        title="some pr",
        issue_created_at=datetime.now(),
        state="open",
        author=jsonable_encoder({"login": "pr_creator_username"}),
    )

    # Create issue reference
    await IssueReference.create(
        session=session,
        issue_id=issue.id,
        reference_type=ReferenceType.PULL_REQUEST,
        pull_request_id=pr.id,
        external_id=str(pr.id),
    )

    m.assert_has_calls(
        [
            call(
                session=ANY,
                org_id=organization.id,
                typ=NotificationType.issue_pledge_created,
                notif=ANY,  # deep check is checked elsewhere
            ),
            call(
                session=ANY,
                org_id=organization.id,
                typ=NotificationType.maintainer_issue_pull_request_created,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                    payload=ANY,
                ),
            ),
            call(
                session=ANY,
                org_id=pledging_organization.id,
                typ=NotificationType.issue_pledged_pull_request_created,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                    payload=ANY,
                ),
            ),
        ]
    )


@pytest.mark.asyncio
async def test_pledged_issue_pull_request_merged(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
    pledging_organization: Organization,
) -> None:
    m = mocker.patch("polar.notifications.service.NotificationsService.send_to_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=pledging_organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-4",
    )

    # Update to created
    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id",
    )

    # Create pull request
    pr = await PullRequest.create(
        session=session,
        platform=Platforms.github,
        number=1294,
        external_id=912,
        repository_id=repository.id,
        organization_id=organization.id,
        title="some pr",
        issue_created_at=datetime.now(),
        merged_at=datetime.now(),
        state="closed",
        author=jsonable_encoder({"login": "pr_creator_username"}),
    )

    # Create issue reference
    await IssueReference.create(
        session=session,
        issue_id=issue.id,
        reference_type=ReferenceType.PULL_REQUEST,
        pull_request_id=pr.id,
        external_id=str(pr.id),
    )

    m.assert_has_calls(
        [
            call(
                session=ANY,
                org_id=organization.id,
                typ=NotificationType.issue_pledge_created,
                notif=ANY,  # deep check is checked elsewhere
            ),
            call(
                session=ANY,
                org_id=organization.id,
                typ=NotificationType.maintainer_issue_pull_request_merged,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                    payload=ANY,
                ),
            ),
            call(
                session=ANY,
                org_id=pledging_organization.id,
                typ=NotificationType.issue_pledged_pull_request_merged,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                    payload=ANY,
                ),
            ),
        ]
    )


@pytest.mark.asyncio
async def test_pledged_issue_branch_created(
    session: AsyncSession,
    predictable_organization: Organization,
    predictable_repository: Repository,
    predictable_issue: Issue,
    mocker: MockerFixture,
    predictable_pledging_organization: Organization,
) -> None:
    m = mocker.spy(NotificationsService, "send_to_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=predictable_issue.id,
        repository_id=predictable_repository.id,
        organization_id=predictable_organization.id,
        amount=12300,
        fee=123,
        by_organization_id=predictable_pledging_organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-5",
    )

    # Update to created
    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id",
    )

    # Create issue reference
    await IssueReference.create(
        session=session,
        issue_id=predictable_issue.id,
        reference_type=ReferenceType.EXTERNAL_GITHUB_COMMIT,
        external_id="xxx",
        external_source=jsonable_encoder(
            ExternalGitHubCommitReference(
                organization_name="ext_orgname",
                repository_name="ext_reponame",
                user_login="ext_login",
                user_avatar="xxx",
                commit_id="abc123",
                branch_name=None,
                message="Hello World",
            )
        ),
    )

    m.assert_has_calls(
        [
            call(
                self=ANY,
                session=ANY,
                org_id=predictable_organization.id,
                typ=NotificationType.issue_pledge_created,
                notif=ANY,  # deep check is checked elsewhere
            ),
            call(
                self=ANY,
                session=ANY,
                org_id=ANY,
                typ=NotificationType.maintainer_issue_branch_created,
                notif=PartialNotification(
                    issue_id=predictable_issue.id,
                    payload=MaintainerIssueBranchCreated(
                        issue_url="https://github.com/testorg/testrepo/issues/123",
                        issue_title=predictable_issue.title,
                        issue_number=123,
                        branch_creator_username="ext_login",
                        commit_link="https://github.com/ext_orgname/ext_reponame/commit/abc123",
                    ),
                ),
            ),
            call(
                self=ANY,
                session=ANY,
                org_id=ANY,
                typ=NotificationType.issue_pledged_branch_created,
                notif=PartialNotification(
                    issue_id=predictable_issue.id,
                    payload=IssuePledgedBranchCreated(
                        issue_url="https://github.com/testorg/testrepo/issues/123",
                        issue_title=predictable_issue.title,
                        issue_number=123,
                        branch_creator_username="ext_login",
                        commit_link="https://github.com/ext_orgname/ext_reponame/commit/abc123",
                    ),
                ),
            ),
        ]
    )
