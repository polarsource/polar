import uuid

import pytest
from pytest_mock import MockerFixture

from polar.account.tasks import (
    AccountDoesNotExist,
    account_reviewed,
    account_under_review,
)
from polar.held_transfer.service import HeldTransferService
from polar.held_transfer.service import held_transfer as held_transfer_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, User
from polar.notifications.service import NotificationsService
from polar.notifications.service import notifications as notification_service
from polar.worker import JobContext, PolarWorkerContext
from tests.account.conftest import create_account


@pytest.mark.asyncio
class TestAccountUnderReview:
    async def test_not_existing_account(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(AccountDoesNotExist):
            await account_under_review(job_context, uuid.uuid4(), polar_worker_context)

    async def test_existing_account(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
        user: User,
    ) -> None:
        account = await create_account(
            session, admin=user, status=Account.Status.UNDER_REVIEW
        )

        # then
        session.expunge_all()

        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )
        send_account_under_review_discord_notification_mock = mocker.patch(
            "polar.account.tasks.send_account_under_review_discord_notification"
        )

        await account_under_review(job_context, account.id, polar_worker_context)

        send_to_user_mock.assert_called_once()
        send_account_under_review_discord_notification_mock.assert_called_once()


@pytest.mark.asyncio
class TestAccountReviewed:
    async def test_not_existing_account(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(AccountDoesNotExist):
            await account_reviewed(job_context, uuid.uuid4(), polar_worker_context)

    async def test_existing_account(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
        user: User,
    ) -> None:
        account = await create_account(
            session, admin=user, status=Account.Status.ACTIVE
        )

        release_account_mock = mocker.patch.object(
            held_transfer_service,
            "release_account",
            spec=HeldTransferService.release_account,
        )

        # then
        session.expunge_all()

        await account_reviewed(job_context, account.id, polar_worker_context)

        release_account_mock.assert_called_once()
