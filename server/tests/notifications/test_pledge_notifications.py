from unittest.mock import ANY
import pytest
from polar.kit.extensions.sqlalchemy import sql
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.notifications.schemas import NotificationType
from polar.notifications.service import NotificationsService, PartialNotification
from polar.postgres import AsyncSession
from pytest_mock import MockerFixture


@pytest.mark.asyncio
async def test_create_pledge_from_created(
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

    # Check notifictions
    assert m.call_count == 1
    m.assert_called_once_with(
        session=ANY,
        org_id=organization.id,
        typ=NotificationType.issue_pledge_created,
        notif=PartialNotification(
            issue_id=issue.id,
            pledge_id=pledge.id,
            payload=ANY,
        ),
    )


@pytest.mark.asyncio
async def test_create_pledge_initiated_then_created(
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
        state="initiated",
    )

    # Check notifictions
    assert m.call_count == 0

    # Update to created
    await pledge.update(session=session, state="created")

    # Check notifictions
    assert m.call_count == 1
    m.assert_called_once_with(
        session=ANY,
        org_id=organization.id,
        typ=NotificationType.issue_pledge_created,
        notif=PartialNotification(
            issue_id=issue.id,
            pledge_id=pledge.id,
            payload=ANY,
        ),
    )


@pytest.mark.asyncio
async def test_deduplicate(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:

    spy = mocker.spy(NotificationsService, "create_for_org")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        by_organization_id=organization.id,
        state="initiated",
    )

    # Check notifictions
    assert spy.call_count == 0

    # Update to created
    await pledge.update(session=session, state="created")
    await pledge.update(session=session, state="created")
    await pledge.update(session=session, state="created")

    # Check notifictions
    assert spy.call_count == 3

    # Check persisted notifications
    all = (
        (
            await session.execute(
                sql.select(Notification).where(Notification.issue_id == issue.id)
            )
        )
        .unique()
        .all()
    )

    assert len(all) == 1
