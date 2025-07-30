import uuid

import pytest
from pytest_mock import MockerFixture

from polar.account.tasks import (
    AccountDoesNotExist,
    account_reviewed,
    account_under_review,
)
from polar.held_balance.service import HeldBalanceService
from polar.held_balance.service import held_balance as held_balance_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, User
from polar.notifications.service import NotificationsService
from polar.notifications.service import notifications as notification_service
from tests.account.conftest import create_account
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


@pytest.mark.asyncio
class TestAccountUnderReview:
    async def test_not_existing_account(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(AccountDoesNotExist):
            await account_under_review(uuid.uuid4())

    async def test_existing_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.UNDER_REVIEW
        )
        organization = await create_organization(save_fixture, account=account)

        # then
        session.expunge_all()

        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )
        create_account_review_thread_mock = mocker.patch(
            "polar.account.tasks.plain_service.create_account_review_thread"
        )

        await account_under_review(account.id)

        send_to_user_mock.assert_called_once()
        create_account_review_thread_mock.assert_called_once()

    async def test_organization_account_relationship_loaded(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """Test that Organization.account relationship is properly loaded to avoid lazy='raise' error"""
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.UNDER_REVIEW
        )
        organization = await create_organization(save_fixture, account=account)

        session.expunge_all()

        # Mock only the notification service, not plain_service.create_account_review_thread
        # This ensures that the actual method runs and would fail if organization.account
        # is not properly loaded due to lazy='raise'
        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )

        # Mock the Plain client to avoid external API calls
        mock_plain_client = mocker.patch(
            "polar.integrations.plain.service.PlainService._get_plain_client"
        )
        mock_plain_instance = mocker.AsyncMock()
        mock_result = mocker.MagicMock()
        mock_result.error = None
        mock_plain_instance.upsert_customer.return_value = mock_result
        mock_plain_instance.create_thread.return_value = mock_result
        mock_plain_client.return_value.__aenter__.return_value = mock_plain_instance

        # This should not raise InvalidRequestError about Organization.account lazy='raise'
        await account_under_review(account.id)

        send_to_user_mock.assert_called_once()
        mock_plain_instance.upsert_customer.assert_called_once()
        mock_plain_instance.create_thread.assert_called_once()


@pytest.mark.asyncio
class TestAccountReviewed:
    async def test_not_existing_account(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(AccountDoesNotExist):
            await account_reviewed(uuid.uuid4())

    async def test_existing_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )

        release_account_mock = mocker.patch.object(
            held_balance_service,
            "release_account",
            spec=HeldBalanceService.release_account,
        )
        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )

        # then
        session.expunge_all()

        await account_reviewed(account.id)

        release_account_mock.assert_called_once()
        send_to_user_mock.assert_called_once()
