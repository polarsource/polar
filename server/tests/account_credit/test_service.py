from unittest.mock import ANY

import pytest
from pytest_mock import MockerFixture

from polar.account_credit.service import account_credit_service
from polar.models import Account, Organization
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestGrant:
    async def test_grant_without_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        credit = await account_credit_service.grant(
            session,
            account=account,
            amount=5000,
            title="Test Credit",
        )

        assert credit.account_id == account.id
        assert credit.amount == 5000
        assert credit.title == "Test Credit"
        assert credit.used == 0
        assert credit.revoked_at is None

        await session.refresh(account)
        assert account.credit_balance == 5000

    async def test_grant_with_organization_sends_notification(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        organization: Organization,
    ) -> None:
        send_to_org_members_mock = mocker.patch(
            "polar.account_credit.service.notifications_service.send_to_org_members"
        )

        # Link organization to account
        organization.account = account
        await save_fixture(organization)

        credit = await account_credit_service.grant(
            session,
            account=account,
            amount=5000,
            title="Signup Bonus",
            organization=organization,
        )

        assert credit.account_id == account.id
        assert credit.amount == 5000
        assert credit.title == "Signup Bonus"

        # Verify notification was sent
        send_to_org_members_mock.assert_called_once_with(
            session,
            org_id=organization.id,
            notif=ANY,
        )

        # Verify notification payload
        call_args = send_to_org_members_mock.call_args
        notification: PartialNotification = call_args.kwargs["notif"]
        assert notification.type == NotificationType.maintainer_account_credits_granted
        assert isinstance(
            notification.payload, MaintainerAccountCreditsGrantedNotificationPayload
        )
        assert notification.payload.organization_name == organization.name
        assert notification.payload.amount == 5000

    async def test_grant_updates_account_balance(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        initial_balance = account.credit_balance

        await account_credit_service.grant(
            session,
            account=account,
            amount=1000,
            title="First Credit",
        )

        await session.refresh(account)
        assert account.credit_balance == initial_balance + 1000

        await account_credit_service.grant(
            session,
            account=account,
            amount=2000,
            title="Second Credit",
        )

        await session.refresh(account)
        assert account.credit_balance == initial_balance + 3000


@pytest.mark.asyncio
class TestRevoke:
    async def test_revoke_credit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        # Grant a credit first
        credit = await account_credit_service.grant(
            session,
            account=account,
            amount=5000,
            title="Test Credit",
        )

        await session.refresh(account)
        initial_balance = account.credit_balance
        assert initial_balance >= 5000

        # Revoke the credit
        revoked_credit = await account_credit_service.revoke(
            session,
            credit=credit,
            account=account,
        )

        assert revoked_credit.revoked_at is not None
        assert revoked_credit.id == credit.id

        await session.refresh(account)
        assert account.credit_balance == initial_balance - 5000


@pytest.mark.asyncio
class TestGetActive:
    async def test_get_active_credits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        # Grant two credits
        credit1 = await account_credit_service.grant(
            session,
            account=account,
            amount=1000,
            title="Credit 1",
        )

        credit2 = await account_credit_service.grant(
            session,
            account=account,
            amount=2000,
            title="Credit 2",
        )

        active_credits = await account_credit_service.get_active(session, account)
        assert len(active_credits) == 2
        assert credit1.id in [c.id for c in active_credits]
        assert credit2.id in [c.id for c in active_credits]

        # Revoke one credit
        await account_credit_service.revoke(session, credit=credit1, account=account)

        active_credits = await account_credit_service.get_active(session, account)
        assert len(active_credits) == 1
        assert active_credits[0].id == credit2.id
