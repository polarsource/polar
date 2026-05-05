import uuid
from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, User
from polar.models.organization import OrganizationStatus
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    organization_created,
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
        user: User,
    ) -> None:
        # Update organization to have under review status
        organization.status = OrganizationStatus.REVIEW
        await save_fixture(organization)

        # then
        session.expunge_all()

        enqueue_job_mock = mocker.patch("polar.organization.tasks.enqueue_job")

        await organization_under_review(organization.id)

        enqueue_job_mock.assert_called_once_with(
            "organization_review.run_agent",
            organization_id=organization.id,
            auto_approve_eligible=False,
        )

    async def test_auto_approve_eligible(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Org under review and previously reviewed → auto-approve eligible
        organization.status = OrganizationStatus.REVIEW
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        await save_fixture(organization)

        session.expunge_all()

        enqueue_job_mock = mocker.patch("polar.organization.tasks.enqueue_job")

        await organization_under_review(organization.id)

        enqueue_job_mock.assert_called_once_with(
            "organization_review.run_agent",
            organization_id=organization.id,
            auto_approve_eligible=True,
        )
