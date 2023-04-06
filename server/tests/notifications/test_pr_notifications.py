from datetime import datetime
from unittest.mock import ANY, call
import pytest
from polar.enums import Platforms
from polar.models import notification
from polar.models.issue import Issue
from polar.models.issue_reference import IssueReference, ReferenceType
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.notifications.schemas import NotificationType
from polar.notifications.service import PartialNotification, notifications
from polar.postgres import AsyncSession
from pytest_mock import MockerFixture
from fastapi.encoders import jsonable_encoder


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
        "create_for_org",
    )

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        by_organization_id=pledging_organization.id,
        state="created",
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
    m = mocker.patch("polar.notifications.service.NotificationsService.create_for_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        by_organization_id=pledging_organization.id,
        state="created",
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
