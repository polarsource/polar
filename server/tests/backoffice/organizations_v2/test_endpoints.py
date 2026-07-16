from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.backoffice.organizations_v2.endpoints import _stripe_reject_reason_for_aup
from polar.models import PayoutAccount
from polar.models.organization import Organization, OrganizationStatus
from polar.models.user import User
from polar.models.user_session import UserSession
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import AUPSection
from polar.postgres import AsyncSession, get_db_session
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


class TestStripeRejectReasonForAup:
    @pytest.mark.parametrize(
        "section",
        [
            AUPSection.VIRUSES_SPYWARE,
            AUPSection.FAKE_TESTIMONIALS_REVIEWS,
            AUPSection.INTELLECTUAL_PROPERTY_INFRINGEMENT,
            AUPSection.GET_RICH_SCHEMES,
            AUPSection.RESELLING_SOFTWARE_LICENSES,
        ],
    )
    def test_fraud_sections(self, section: AUPSection) -> None:
        assert _stripe_reject_reason_for_aup(section) == "fraud"

    @pytest.mark.parametrize(
        "section",
        [
            AUPSection.ADULT_CONTENT,
            AUPSection.GAMBLING_BETTING,
            AUPSection.MEDICAL_HEALTH_ADVICE,
            AUPSection.PHYSICAL_PRODUCTS,
            AUPSection.OTHER,
        ],
    )
    def test_terms_of_service_sections(self, section: AUPSection) -> None:
        assert _stripe_reject_reason_for_aup(section) == "terms_of_service"

    def test_every_section_maps_to_fraud_or_terms_of_service(self) -> None:
        # An AUP violation never implies "other" (risk of delinquency).
        for section in AUPSection:
            assert _stripe_reject_reason_for_aup(section) in {
                "fraud",
                "terms_of_service",
            }


@pytest.mark.asyncio
class TestDenyDialog:
    async def test_stores_violated_aup_section(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "trading_financial",
            },
        )

        assert response.status_code == 303

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is not None
        assert current.violated_aup_section == AUPSection.TRADING_FINANCIAL

    async def test_missing_aup_section_does_not_deny(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={"override_reason": "Crypto trading bot"},
        )

        assert response.status_code == 200
        assert "An AUP section is required" in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None

    async def test_invalid_aup_section_does_not_deny(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "not_a_section",
            },
        )

        assert response.status_code == 200
        assert "Invalid AUP section." in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None

    async def test_disables_stripe_account_when_opted_in(
        self,
        mocker: MockerFixture,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "trading_financial",
                "disable_stripe_account": "on",
                "stripe_reject_reason": "fraud",
            },
        )

        assert response.status_code == 303
        enqueue_job_mock.assert_any_call(
            "payout_account.reject_stripe_account",
            payout_account_id=stripe_payout_account.id,
            reason="fraud",
        )

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is not None
        assert current.violated_aup_section == AUPSection.TRADING_FINANCIAL

    async def test_invalid_stripe_reject_reason_does_not_deny(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "trading_financial",
                "disable_stripe_account": "on",
                "stripe_reject_reason": "not_valid",
            },
        )

        assert response.status_code == 200
        assert "Select a valid Stripe reject reason." in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None


@pytest.mark.asyncio
class TestBlockDialog:
    async def test_disables_stripe_account_when_opted_in(
        self,
        mocker: MockerFixture,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        response = await backoffice_client.post(
            f"/organizations/{organization.id}/block-dialog",
            data={
                "disable_stripe_account": "on",
                "stripe_reject_reason": "terms_of_service",
            },
        )

        assert response.status_code == 303
        enqueue_job_mock.assert_any_call(
            "payout_account.reject_stripe_account",
            payout_account_id=stripe_payout_account.id,
            reason="terms_of_service",
        )

        assert organization.status == OrganizationStatus.BLOCKED

    async def test_invalid_stripe_reject_reason_does_not_block(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        previous_status = organization.status

        response = await backoffice_client.post(
            f"/organizations/{organization.id}/block-dialog",
            data={
                "disable_stripe_account": "on",
                "stripe_reject_reason": "nope",
            },
        )

        assert response.status_code == 200
        assert "Select a valid Stripe reject reason." in response.text
        assert organization.status == previous_status


@pytest.mark.asyncio
class TestOffboardDialog:
    async def test_missing_aup_section_does_not_offboard(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        previous_status = organization.status

        response = await backoffice_client.post(
            f"/organizations/{organization.id}/offboard-dialog",
            data={"reason": "Policy violation"},
        )

        assert response.status_code == 200
        assert "An AUP section is required" in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None
        assert organization.status == previous_status


@pytest.mark.asyncio
class TestDeletePayoutAccount:
    async def test_soft_deleted_organization_can_open_delete_modal(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        organization.deleted_at = datetime.now(UTC)
        await save_fixture(organization)

        response = await backoffice_client.get(
            f"/organizations/{organization.id}/delete-payout-account"
        )

        assert response.status_code == 200
        assert "Delete Payout Account" in response.text
