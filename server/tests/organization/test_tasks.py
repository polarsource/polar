import uuid

import pytest
from pytest_mock import MockerFixture

from polar.held_balance.service import HeldBalanceService
from polar.held_balance.service import held_balance as held_balance_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Organization
from polar.notifications.service import NotificationsService
from polar.notifications.service import notifications as notification_service
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    organization_created,
    organization_reviewed,
    organization_under_review,
)
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestOrganizationCreated:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_created(uuid.uuid4())

    async def test_existing_organization(
        self, organization: Organization, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        await organization_created(organization.id)


@pytest.mark.asyncio
class TestOrganizationUnderReview:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_under_review(uuid.uuid4())

    async def test_existing_organization(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        # Update organization to have under review status
        organization.status = Organization.Status.UNDER_REVIEW
        await save_fixture(organization)

        # then
        session.expunge_all()

        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )
        create_account_review_thread_mock = mocker.patch(
            "polar.organization.tasks.plain_service.create_account_review_thread"
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=mocker.MagicMock(id=uuid.uuid4()),
        )

        await organization_under_review(organization.id)

        send_to_user_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()

    async def test_existing_organization_with_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
    ) -> None:
        # Update organization to have under review status and account
        organization.status = Organization.Status.UNDER_REVIEW
        organization.account_id = account.id
        await save_fixture(organization)

        # then
        session.expunge_all()

        send_to_user_mock = mocker.patch.object(
            notification_service,
            "send_to_user",
            spec=NotificationsService.send_to_user,
        )
        create_account_review_thread_mock = mocker.patch(
            "polar.organization.tasks.plain_service.create_account_review_thread"
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=mocker.MagicMock(id=uuid.uuid4()),
        )

        await organization_under_review(organization.id)

        send_to_user_mock.assert_called_once()
        create_account_review_thread_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()


@pytest.mark.asyncio
class TestOrganizationReviewed:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_reviewed(uuid.uuid4())

    async def test_existing_organization(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        # Update organization to have active status
        organization.status = Organization.Status.ACTIVE
        await save_fixture(organization)

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
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=mocker.MagicMock(id=uuid.uuid4()),
        )

        # then
        session.expunge_all()

        await organization_reviewed(organization.id)

        send_to_user_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()

    async def test_existing_organization_with_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
    ) -> None:
        # Update organization to have active status and account
        organization.status = Organization.Status.ACTIVE
        organization.account_id = account.id
        await save_fixture(organization)

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
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=mocker.MagicMock(id=uuid.uuid4()),
        )

        # then
        session.expunge_all()

        await organization_reviewed(organization.id)

        release_account_mock.assert_called_once()
        send_to_user_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()
