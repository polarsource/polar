from unittest.mock import ANY

import pytest
from pytest_mock import MockerFixture

from polar.kit.extensions.sqlalchemy import sql
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.notifications.notification import MaintainerPledgeCreatedNotification
from polar.notifications.schemas import NotificationType
from polar.notifications.service import NotificationsService, PartialNotification
from polar.pledge.schemas import PledgeState, PledgeType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_create_pledge_from_created(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch("polar.notifications.service.NotificationsService.send_to_org")

    payment_id = "xxx-1"

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=organization.id,
        state=PledgeState.initiated,
        payment_id=payment_id,
    )
    await pledge_service.mark_created_by_payment_id(
        session,
        payment_id,
        pledge.amount,
        "trx-id",
    )

    # Check notifictions
    assert m.call_count == 1
    m.assert_called_once_with(
        session=ANY,
        org_id=organization.id,
        notif=PartialNotification(
            issue_id=issue.id,
            pledge_id=pledge.id,
            payload=MaintainerPledgeCreatedNotification(
                pledge_id=pledge.id,
                pledger_name=organization.name,
                pledge_amount="123",
                issue_url=f"https://github.com/{organization.name}/{repository.name}/issues/{issue.number}",
                issue_title=issue.title,
                issue_org_name=organization.name,
                issue_repo_name=repository.name,
                issue_number=issue.number,
                maintainer_has_stripe_account=False,
                pledge_type=PledgeType.pay_upfront,
            ),
        ),
    )


@pytest.mark.asyncio
async def test_deduplicate(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    user_organization: UserOrganization,
    user_organization_second: UserOrganization,  # two members
    mocker: MockerFixture,
) -> None:
    spy = mocker.spy(NotificationsService, "send_to_org")
    mocker.patch("polar.worker._enqueue_job")

    pledge = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-2",
    )

    # Check notifictions
    assert spy.call_count == 0

    assert pledge.payment_id

    # Update to created
    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id-2",
    )

    # do it again, (should not do anything)
    await pledge_service.mark_created_by_payment_id(
        session,
        pledge.payment_id,
        pledge.amount,
        "trx-id-2",
    )

    # Check notifictions
    assert spy.call_count == 1

    # Check persisted notifications
    all_first_user = (
        (
            await session.execute(
                sql.select(Notification).where(
                    Notification.issue_id == issue.id,
                    Notification.user_id == user_organization.user_id,
                )
            )
        )
        .unique()
        .all()
    )

    assert len(all_first_user) == 1

    all_second_user = (
        (
            await session.execute(
                sql.select(Notification).where(
                    Notification.issue_id == issue.id,
                    Notification.user_id == user_organization_second.user_id,
                )
            )
        )
        .unique()
        .all()
    )

    assert len(all_second_user) == 1
