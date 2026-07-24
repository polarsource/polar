from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, OrganizationReview
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


class TestCanChangePlan:
    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.ACTIVE,
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
        ],
    )
    def test_allowed_statuses(self, status: OrganizationStatus) -> None:
        organization = Organization(status=status)
        assert organization.can_change_plan() is True

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.CREATED,
            OrganizationStatus.DENIED,
            OrganizationStatus.BLOCKED,
            OrganizationStatus.OFFBOARDING,
            OrganizationStatus.OFFBOARDED,
        ],
    )
    def test_blocked_statuses(self, status: OrganizationStatus) -> None:
        organization = Organization(status=status)
        assert organization.can_change_plan() is False


@pytest.mark.asyncio
class TestReviewRelationship:
    async def test_resolves_to_live_review_when_soft_deleted_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """A soft-deleted prior review (e.g. a reset grandfathered one) must not
        shadow the live one — `organization.review` is the live row only."""
        await save_fixture(
            OrganizationReview(
                organization_id=organization.id,
                verdict=OrganizationReview.Verdict.FAIL,
                risk_score=90.0,
                violated_sections=[],
                reason="superseded",
                model_used="test",
                deleted_at=utc_now(),
            )
        )
        live = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=90.0,
            violated_sections=[],
            reason="live",
            model_used="test",
        )
        await save_fixture(live)

        session.expunge_all()
        repository = OrganizationRepository.from_session(session)
        loaded = await repository.get_by_id(
            organization.id, options=(joinedload(Organization.review),)
        )

        assert loaded is not None
        assert loaded.review is not None
        assert loaded.review.id == live.id


@pytest.mark.asyncio
class TestGetCustomEmailLinkUrl:
    async def test_returns_none_without_override(
        self, customer: Customer, organization: Organization
    ) -> None:
        assert organization.get_custom_email_link_url(customer, customer.email) is None

    async def test_uses_db_setting_and_appends_identifiers(
        self, customer: Customer, organization: Organization
    ) -> None:
        organization.feature_settings = {"custom_email_link_enabled": True}
        organization.customer_email_settings = {
            **organization.customer_email_settings,
            "link_url": "https://acme.example.com/portal",
        }
        customer.external_id = "usr_123"

        url = organization.get_custom_email_link_url(customer, customer.email)

        assert url is not None
        params = parse_qs(urlparse(url).query)
        assert url.startswith("https://acme.example.com/portal?")
        assert params["email"] == [customer.email]
        assert params["external_id"] == ["usr_123"]

    async def test_db_setting_takes_precedence_over_env_override(
        self,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        mocker.patch.dict(
            settings.CUSTOMER_PORTAL_URL_OVERRIDES,
            {str(organization.id): "https://legacy.example.com/portal"},
        )
        organization.feature_settings = {"custom_email_link_enabled": True}
        organization.customer_email_settings = {
            **organization.customer_email_settings,
            "link_url": "https://acme.example.com/portal",
        }

        url = organization.get_custom_email_link_url(customer, customer.email)

        assert url is not None
        assert url.startswith("https://acme.example.com/portal?")

    async def test_disabled_flag_ignores_db_setting(
        self, customer: Customer, organization: Organization
    ) -> None:
        organization.feature_settings = {"custom_email_link_enabled": False}
        organization.customer_email_settings = {
            **organization.customer_email_settings,
            "link_url": "https://acme.example.com/portal",
        }

        assert organization.get_custom_email_link_url(customer, customer.email) is None

    async def test_disabled_flag_still_uses_env_override(
        self,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        mocker.patch.dict(
            settings.CUSTOMER_PORTAL_URL_OVERRIDES,
            {str(organization.id): "https://legacy.example.com/portal"},
        )
        organization.feature_settings = {"custom_email_link_enabled": False}
        organization.customer_email_settings = {
            **organization.customer_email_settings,
            "link_url": "https://acme.example.com/portal",
        }

        url = organization.get_custom_email_link_url(customer, customer.email)

        assert url is not None
        assert url.startswith("https://legacy.example.com/portal?")

    async def test_falls_back_to_env_override(
        self,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        mocker.patch.dict(
            settings.CUSTOMER_PORTAL_URL_OVERRIDES,
            {str(organization.id): "https://legacy.example.com/portal"},
        )

        url = organization.get_custom_email_link_url(customer, customer.email)

        assert url is not None
        params = parse_qs(urlparse(url).query)
        assert url.startswith("https://legacy.example.com/portal?")
        assert params["email"] == [customer.email]
        assert "external_id" not in params
