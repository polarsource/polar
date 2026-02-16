"""Tests for organization review service - risk signal monitoring."""

from datetime import timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Customer, Organization
from polar.models.dispute import DisputeStatus
from polar.models.organization import OrganizationStatus
from polar.models.organization_review_event import (
    OrganizationReviewType,
    ReviewEventVerdict,
    RiskTriggerType,
)
from polar.models.payment import PaymentStatus
from polar.organization.review.repository import OrganizationReviewEventRepository
from polar.organization.review.service import OrganizationReviewService
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_dispute,
    create_order,
    create_organization,
    create_payment,
    create_refund,
)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.organization.review.service.enqueue_job")


@pytest.fixture
def organization_review_service() -> OrganizationReviewService:
    return OrganizationReviewService()


async def _create_org_with_customer(
    save_fixture: SaveFixture,
    status: OrganizationStatus = OrganizationStatus.ACTIVE,
    **kwargs: object,
) -> tuple[Organization, Customer]:
    """Helper to create an organization with a customer."""
    org = await create_organization(save_fixture, status=status, **kwargs)
    customer = await create_customer(save_fixture, organization=org)
    return org, customer


# =============================================================================
# Test: _get_active_organization
# =============================================================================


@pytest.mark.asyncio
class TestGetActiveOrganization:
    async def test_returns_active_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return organization when it's ACTIVE."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        result = await organization_review_service._get_active_organization(
            session, org.id
        )

        assert result is not None
        assert result.id == org.id

    async def test_returns_none_for_nonexistent_org(
        self,
        session: AsyncSession,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return None for non-existent organization."""
        result = await organization_review_service._get_active_organization(
            session, uuid4()
        )

        assert result is None

    async def test_returns_none_for_org_under_initial_review(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return None for organization already under initial review."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.INITIAL_REVIEW
        )

        result = await organization_review_service._get_active_organization(
            session, org.id
        )

        assert result is None

    async def test_returns_none_for_org_under_ongoing_review(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return None for organization already under ongoing review."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ONGOING_REVIEW
        )

        result = await organization_review_service._get_active_organization(
            session, org.id
        )

        assert result is None


# =============================================================================
# Test: _should_skip_check (debouncing)
# =============================================================================


@pytest.mark.asyncio
class TestShouldSkipCheck:
    async def test_skip_when_recently_calculated(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should skip when metrics were calculated within debounce window."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_metrics={
                "30d": {
                    "calculated_at": utc_now().isoformat(),
                }
            },
        )

        result = organization_review_service._should_skip_check(org, "auth_rate")

        assert result is True

    async def test_no_skip_when_calculated_long_ago(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not skip when metrics were calculated outside debounce window."""
        old_time = utc_now() - timedelta(minutes=10)
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_metrics={
                "30d": {
                    "calculated_at": old_time.isoformat(),
                }
            },
        )

        result = organization_review_service._should_skip_check(org, "auth_rate")

        assert result is False

    async def test_no_skip_when_no_previous_metrics(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not skip when no previous metrics exist."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_metrics={},
        )

        result = organization_review_service._should_skip_check(org, "auth_rate")

        assert result is False

    async def test_no_skip_when_risk_metrics_is_none(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not skip when risk_metrics is None."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
        )
        org.risk_metrics = None

        result = organization_review_service._should_skip_check(org, "auth_rate")

        assert result is False


# =============================================================================
# Test: _get_threshold (with overrides)
# =============================================================================


@pytest.mark.asyncio
class TestGetThreshold:
    async def test_returns_default_when_no_override(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return default threshold when no override set."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
        )

        result = organization_review_service._get_threshold(org, "refund_rate", 0.15)

        assert result == 0.15

    async def test_returns_override_when_set(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return override threshold when set and not expired."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_threshold_overrides={
                "refund_rate": {
                    "value": 0.25,
                    "expires_at": (utc_now() + timedelta(days=30)).isoformat(),
                    "set_at": utc_now().isoformat(),
                    "set_by_user_id": None,
                    "reason": "Seasonal business",
                }
            },
        )

        result = organization_review_service._get_threshold(org, "refund_rate", 0.15)

        assert result == 0.25

    async def test_returns_default_when_override_expired(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return default threshold when override has expired."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_threshold_overrides={
                "refund_rate": {
                    "value": 0.25,
                    "expires_at": (utc_now() - timedelta(days=1)).isoformat(),
                    "set_at": (utc_now() - timedelta(days=30)).isoformat(),
                    "set_by_user_id": None,
                    "reason": "Seasonal business",
                }
            },
        )

        result = organization_review_service._get_threshold(org, "refund_rate", 0.15)

        assert result == 0.15

    async def test_returns_override_when_no_expiration(
        self,
        save_fixture: SaveFixture,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should return override threshold when expires_at is None (permanent)."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_threshold_overrides={
                "refund_rate": {
                    "value": 0.30,
                    "expires_at": None,
                    "set_at": utc_now().isoformat(),
                    "set_by_user_id": None,
                    "reason": "Permanent override",
                }
            },
        )

        result = organization_review_service._get_threshold(org, "refund_rate", 0.15)

        assert result == 0.30


# =============================================================================
# Test: check_auth_rate
# =============================================================================


@pytest.mark.asyncio
class TestCheckAuthRate:
    async def test_no_trigger_when_auth_rate_above_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger review when auth rate is above threshold."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create 12 payments - 10 succeeded, 2 failed (83% auth rate > 75%)
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(2):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should not have triggered a review
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0
        enqueue_job_mock.assert_not_called()

    async def test_trigger_when_auth_rate_below_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should trigger review when auth rate is below 75% threshold."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create 12 payments - 7 succeeded, 5 failed (58% auth rate < 75%)
        for _ in range(7):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should have triggered a review
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1
        assert events[0].event_type == OrganizationReviewType.RISK_THRESHOLD
        assert events[0].reason == RiskTriggerType.AUTH_RATE
        assert events[0].verdict == ReviewEventVerdict.NEEDS_REVIEW
        enqueue_job_mock.assert_called_once()

    async def test_no_trigger_when_insufficient_volume(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger when payment volume is below minimum (10)."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create only 5 payments - 2 succeeded, 3 failed (40% auth rate)
        for _ in range(2):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(3):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should not trigger due to insufficient volume
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_skips_org_under_review(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should skip check when org is already under review."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ONGOING_REVIEW
        )

        # Create bad auth rate
        for _ in range(2):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should not trigger - org already under review
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_moves_org_to_ongoing_review(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should move organization status to ONGOING_REVIEW when triggered."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create bad auth rate
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)
        await session.refresh(org)

        assert org.status == OrganizationStatus.ONGOING_REVIEW
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=org.id
        )


# =============================================================================
# Test: check_refund_rate
# =============================================================================


@pytest.mark.asyncio
class TestCheckRefundRate:
    async def test_no_trigger_when_refund_rate_below_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger review when refund rate is below 15%."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 10 successful payments and 1 refund (10% refund rate)
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        # Create 1 refund
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, order=order
        )
        await create_refund(save_fixture, order, payment, amount=100, status="succeeded")

        await organization_review_service.check_refund_rate(session, org.id)

        # Should not trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_trigger_when_refund_rate_above_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should trigger review when refund rate exceeds 15%."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 5 successful payments
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        # Create 2 refunds (40% refund rate considering 5+2=7 payments)
        for _ in range(2):
            order = await create_order(save_fixture, customer=customer)
            payment = await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded, order=order
            )
            await create_refund(
                save_fixture, order, payment, amount=100, status="succeeded"
            )

        await organization_review_service.check_refund_rate(session, org.id)

        # Should trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1
        assert events[0].reason == RiskTriggerType.REFUND_RATE

    async def test_respects_threshold_override(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should use org-specific threshold override if set."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_threshold_overrides={
                "refund_rate": {
                    "value": 0.50,  # 50% threshold instead of 15%
                    "expires_at": None,
                    "set_at": utc_now().isoformat(),
                    "set_by_user_id": None,
                    "reason": "High return business",
                }
            },
        )
        customer = await create_customer(save_fixture, organization=org)

        # Create 5 successful payments and 2 refunds (40% refund rate)
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        for _ in range(2):
            order = await create_order(save_fixture, customer=customer)
            payment = await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded, order=order
            )
            await create_refund(
                save_fixture, order, payment, amount=100, status="succeeded"
            )

        await organization_review_service.check_refund_rate(session, org.id)

        # Should NOT trigger because 40% < 50% override
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0


# =============================================================================
# Test: check_risk_score
# =============================================================================


@pytest.mark.asyncio
class TestCheckRiskScore:
    async def test_no_trigger_when_risk_score_below_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger when P90 risk score is below 75."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create 15 payments with low risk scores
        for i in range(15):
            await create_payment(
                save_fixture,
                org,
                status=PaymentStatus.succeeded,
                risk_score=30 + (i * 2),  # Scores 30-58, P90 would be ~56
            )

        await organization_review_service.check_risk_score(session, org.id)

        # Should not trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_trigger_when_risk_score_above_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should trigger when P90 risk score exceeds 75."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create 15 payments with high risk scores
        for i in range(15):
            await create_payment(
                save_fixture,
                org,
                status=PaymentStatus.succeeded,
                risk_score=70 + (i * 2),  # Scores 70-98, P90 would be ~94
            )

        await organization_review_service.check_risk_score(session, org.id)

        # Should trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1
        assert events[0].reason == RiskTriggerType.RISK_SCORE

    async def test_no_trigger_when_insufficient_volume(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger when payment volume is below minimum (10)."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create only 5 payments with high risk scores
        for _ in range(5):
            await create_payment(
                save_fixture,
                org,
                status=PaymentStatus.succeeded,
                risk_score=90,
            )

        await organization_review_service.check_risk_score(session, org.id)

        # Should not trigger due to insufficient volume
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0


# =============================================================================
# Test: check_dispute_rate
# =============================================================================


@pytest.mark.asyncio
class TestCheckDisputeRate:
    async def test_no_trigger_when_dispute_rate_below_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should not trigger when dispute rate is below 0.75%."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 200 successful payments with 1 dispute (0.5% rate)
        for _ in range(200):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, order=order
        )
        await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.needs_response
        )

        await organization_review_service.check_dispute_rate(session, org.id)

        # Should not trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_trigger_when_dispute_rate_above_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should trigger when dispute rate exceeds 0.75%."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 100 successful payments with 2 disputes (2% rate)
        for _ in range(100):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        for _ in range(2):
            order = await create_order(save_fixture, customer=customer)
            payment = await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded, order=order
            )
            await create_dispute(
                save_fixture, order, payment, status=DisputeStatus.needs_response
            )

        await organization_review_service.check_dispute_rate(session, org.id)

        # Should trigger
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1
        assert events[0].reason == RiskTriggerType.DISPUTE_RATE

    async def test_trigger_chargeback_rate_when_above_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should trigger when chargeback rate exceeds 0.30%."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 100 successful payments with 1 actual chargeback (1% rate)
        for _ in range(100):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        # Create 1 actual chargeback (needs_response = actual chargeback)
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, order=order
        )
        await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.needs_response
        )

        await organization_review_service.check_dispute_rate(session, org.id)

        # Should trigger (dispute rate 1% > 0.75%)
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1

    async def test_prevented_disputes_not_counted_as_chargebacks(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Prevented disputes should not be counted as chargebacks."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 200 successful payments
        for _ in range(200):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        # Create 1 prevented dispute (not a chargeback)
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture, org, status=PaymentStatus.succeeded, order=order
        )
        await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.prevented
        )

        await organization_review_service.check_dispute_rate(session, org.id)

        # Should not trigger - prevented disputes don't count for dispute rate
        # (only 0.5% dispute rate with prevented disputes still counted)
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0


# =============================================================================
# Test: Event details structure
# =============================================================================


@pytest.mark.asyncio
class TestEventDetails:
    async def test_auth_rate_event_details(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Auth rate trigger should include correct details."""
        org = await create_organization(
            save_fixture, status=OrganizationStatus.ACTIVE
        )

        # Create bad auth rate: 5 succeeded, 10 failed (33% auth rate)
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1

        details = events[0].details
        assert details["trigger_type"] == "auth_rate"
        assert details["window"] == "30d"
        assert details["payment_attempt_count"] == 15
        assert details["payment_count"] == 5
        assert 0.30 < details["value"] < 0.40  # ~33%
        assert details["threshold"] == 0.75

    async def test_refund_rate_event_details(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Refund rate trigger should include correct details."""
        org, customer = await _create_org_with_customer(save_fixture)

        # Create 5 payments and 2 refunds (40% refund rate)
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )

        for _ in range(2):
            order = await create_order(save_fixture, customer=customer)
            payment = await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded, order=order
            )
            await create_refund(
                save_fixture, order, payment, amount=100, status="succeeded"
            )

        await organization_review_service.check_refund_rate(session, org.id)

        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1

        details = events[0].details
        assert details["trigger_type"] == "refund_rate"
        assert details["window"] == "30d"
        assert details["payment_count"] == 7  # 5 + 2 from refund orders
        assert details["refund_count"] == 2
        assert details["threshold"] == 0.15


# =============================================================================
# Test: Debouncing integration
# =============================================================================


@pytest.mark.asyncio
class TestDebouncing:
    async def test_skips_check_when_debounced(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should skip check when metrics were recently calculated."""
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_metrics={
                "30d": {
                    "calculated_at": utc_now().isoformat(),
                    "auth_rate": 0.50,  # Bad rate
                }
            },
        )

        # Create bad auth rate
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should not trigger due to debouncing
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 0

    async def test_does_not_skip_when_outside_debounce_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
        organization_review_service: OrganizationReviewService,
    ) -> None:
        """Should perform check when outside debounce window."""
        old_time = utc_now() - timedelta(minutes=10)
        org = await create_organization(
            save_fixture,
            status=OrganizationStatus.ACTIVE,
            risk_metrics={
                "30d": {
                    "calculated_at": old_time.isoformat(),
                    "auth_rate": 0.90,  # Previous good rate
                }
            },
        )

        # Create bad auth rate
        for _ in range(5):
            await create_payment(
                save_fixture, org, status=PaymentStatus.succeeded
            )
        for _ in range(10):
            await create_payment(
                save_fixture, org, status=PaymentStatus.failed
            )

        await organization_review_service.check_auth_rate(session, org.id)

        # Should trigger since outside debounce window
        repo = OrganizationReviewEventRepository.from_session(session)
        events = await repo.get_all(repo.get_by_organization_statement(org.id))
        assert len(events) == 1
