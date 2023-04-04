from datetime import datetime
from unittest.mock import ANY
import pytest
from polar.enums import Platforms
from polar.models.issue import Issue
from polar.models.issue_reference import IssueReference, ReferenceType
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.notifications.schemas import NotificationType
from polar.notifications.service import PartialNotification
from polar.postgres import AsyncSession
from pytest_mock import MockerFixture


@pytest.mark.asyncio
async def test_pledged_issue_pull_request_created(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch("polar.notifications.service.NotificationsService.create_for_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        by_organization_id=organization.id,
        state="created",
    )

    # Check notifictions (pledge created, deep coverage is better checked in other
    # tests)
    assert m.call_count == 1
    m.assert_called_with(
        session=ANY, org_id=ANY, typ=NotificationType.issue_pledge_created, notif=ANY
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
    )

    # Create issue reference
    await IssueReference.create(
        session=session,
        issue_id=issue.id,
        reference_type=ReferenceType.PULL_REQUEST,
        pull_request_id=pr.id,
        external_id=str(pr.id),
    )

    assert m.call_count == 2
    m.assert_called_with(
        session=ANY,
        org_id=ANY,
        typ=NotificationType.issue_pledged_pull_request_created,
        notif=PartialNotification(
            issue_id=issue.id,
        ),
    )

    # TODO: only send if the issue has a peldge!


@pytest.mark.asyncio
async def test_pledged_issue_pull_request_merged(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch("polar.notifications.service.NotificationsService.create_for_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        by_organization_id=organization.id,
        state="created",
    )

    # Check notifictions (pledge created, deep coverage is better checked in other
    # tests)
    assert m.call_count == 1
    m.assert_called_with(
        session=ANY, org_id=ANY, typ=NotificationType.issue_pledge_created, notif=ANY
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
    )

    # Create issue reference
    await IssueReference.create(
        session=session,
        issue_id=issue.id,
        reference_type=ReferenceType.PULL_REQUEST,
        pull_request_id=pr.id,
        external_id=str(pr.id),
    )

    assert m.call_count == 2
    m.assert_called_with(
        session=ANY,
        org_id=ANY,
        typ=NotificationType.issue_pledged_pull_request_merged,
        notif=PartialNotification(
            issue_id=issue.id,
        ),
    )

    # TODO: only send if the issue has a peldge!
