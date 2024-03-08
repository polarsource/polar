from unittest.mock import ANY

import pytest
from pytest_mock import MockerFixture

from polar.kit.extensions.sqlalchemy import sql
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.repository import Repository
from polar.models.user import OAuthAccount, User
from polar.models.user_organization import UserOrganization
from polar.notifications.notification import (
    MaintainerPledgeCreatedNotificationPayload,
    NotificationType,
)
from polar.notifications.service import NotificationsService, PartialNotification
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_create_pledge_from_created(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
) -> None:
    m = mocker.patch(
        "polar.notifications.service.NotificationsService.send_to_org_admins"
    )

    payment_id = "xxx-1"

    pledge = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=organization.id,
        state=PledgeState.initiated,
        payment_id=payment_id,
    )
    await save_fixture(pledge)

    # then
    session.expunge_all()

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
            type=NotificationType.maintainer_pledge_created,
            payload=MaintainerPledgeCreatedNotificationPayload(
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
async def test_create_pledge_from_created_by_user(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
    user: User,
) -> None:
    m = mocker.patch(
        "polar.notifications.service.NotificationsService.send_to_org_admins"
    )

    payment_id = "xxx-1"

    pledge = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_user_id=user.id,
        state=PledgeState.initiated,
        payment_id=payment_id,
    )
    await save_fixture(pledge)

    # then
    session.expunge_all()

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
            type=NotificationType.maintainer_pledge_created,
            payload=MaintainerPledgeCreatedNotificationPayload(
                pledge_id=pledge.id,
                pledger_name=user.email,
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
async def test_create_pledge_from_created_by_user_with_github(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
    user: User,
    user_github_oauth: OAuthAccount,
) -> None:
    m = mocker.patch(
        "polar.notifications.service.NotificationsService.send_to_org_admins"
    )

    payment_id = "xxx-1"

    pledge = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_user_id=user.id,
        state=PledgeState.initiated,
        payment_id=payment_id,
    )
    await save_fixture(pledge)

    # then
    session.expunge_all()

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
            type=NotificationType.maintainer_pledge_created,
            payload=MaintainerPledgeCreatedNotificationPayload(
                pledge_id=pledge.id,
                pledger_name=user_github_oauth.account_username,
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
async def test_create_pledge_from_created_on_behalf_of(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    mocker: MockerFixture,
    user: User,
) -> None:
    m = mocker.patch(
        "polar.notifications.service.NotificationsService.send_to_org_admins"
    )

    payment_id = "xxx-1"

    pledge = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        on_behalf_of_organization_id=organization.id,
        by_user_id=user.id,
        state=PledgeState.initiated,
        payment_id=payment_id,
    )
    await save_fixture(pledge)

    # then
    session.expunge_all()

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
            type=NotificationType.maintainer_pledge_created,
            payload=MaintainerPledgeCreatedNotificationPayload(
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
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    user_organization: UserOrganization,
    user_organization_second: UserOrganization,  # two members
    mocker: MockerFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    user_organization_second.is_admin = True
    await save_fixture(user_organization_second)

    spy = mocker.spy(NotificationsService, "send_to_org_admins")
    mocker.patch("polar.worker._enqueue_job")

    pledge = Pledge(
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=12300,
        fee=123,
        by_organization_id=organization.id,
        state=PledgeState.initiated,
        payment_id="xxx-2",
    )
    await save_fixture(pledge)

    # Check notifictions
    assert spy.call_count == 0

    assert pledge.payment_id

    # then
    session.expunge_all()

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
