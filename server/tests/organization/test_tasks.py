import uuid

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    organization_cancel_expired_subscriptions,
    organization_created,
    organization_offboarded,
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

    async def test_review_status_eligible(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Org in REVIEW status → auto-approve eligible (no prior review needed)
        organization.status = OrganizationStatus.REVIEW
        await save_fixture(organization)

        session.expunge_all()

        enqueue_job_mock = mocker.patch("polar.organization.tasks.enqueue_job")

        await organization_under_review(organization.id)

        enqueue_job_mock.assert_called_once_with(
            "organization_review.run_agent",
            organization_id=organization.id,
            auto_approve_eligible=True,
        )

    async def test_non_review_status_not_eligible(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.CREATED
        await save_fixture(organization)

        session.expunge_all()

        enqueue_job_mock = mocker.patch("polar.organization.tasks.enqueue_job")

        await organization_under_review(organization.id)

        enqueue_job_mock.assert_called_once_with(
            "organization_review.run_agent",
            organization_id=organization.id,
            auto_approve_eligible=False,
        )


@pytest.mark.asyncio
class TestOrganizationOffboarded:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_offboarded(uuid.uuid4())

    async def test_emails_each_member(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        session.expunge_all()

        enqueue_email_mock = mocker.patch(
            "polar.organization.tasks.enqueue_email_template"
        )

        await organization_offboarded(organization.id)

        enqueue_email_mock.assert_called_once()
        args, kwargs = enqueue_email_mock.call_args
        assert kwargs["to_email_addr"] == user.email
        assert organization.name in kwargs["subject"]
        email = args[0]
        assert email.props.account_url == organization.account_url


@pytest.mark.asyncio
class TestOrganizationCancelExpiredSubscriptions:
    async def test_invokes_service(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        cancel_mock = mocker.patch(
            "polar.organization.tasks.organization_service."
            "cancel_expired_organizations_subscriptions"
        )

        await organization_cancel_expired_subscriptions()

        cancel_mock.assert_called_once()
