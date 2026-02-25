from datetime import datetime
from unittest.mock import MagicMock

from polar.models.organization import OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.organization_review.collectors.history import collect_history_data
from polar.organization_review.schemas import HistoryData


def _build_user(
    *,
    email: str = "test@example.com",
    blocked_at: datetime | None = None,
) -> MagicMock:
    user = MagicMock()
    user.email = email
    user.blocked_at = blocked_at
    return user


def _build_org(
    *,
    slug: str = "test-org",
    status: OrganizationStatus = OrganizationStatus.ACTIVE,
    review: MagicMock | None = None,
    blocked_at: datetime | None = None,
) -> MagicMock:
    org = MagicMock()
    org.slug = slug
    org.status = status
    org.review = review
    org.blocked_at = blocked_at
    return org


def _build_review(
    *,
    verdict: str = "PASS",
    appeal_decision: str | None = None,
) -> MagicMock:
    review = MagicMock()
    # Simulate SQLAlchemy loading String columns as plain str (not StrEnum)
    review.verdict = verdict
    review.appeal_decision = appeal_decision
    return review


class TestCollectHistoryData:
    def test_none_user(self) -> None:
        result = collect_history_data(None, [])
        assert result == HistoryData()

    def test_no_orgs(self) -> None:
        user = _build_user()
        result = collect_history_data(user, [])
        assert result.user_email == "test@example.com"
        assert result.prior_organizations == []
        assert result.has_prior_denials is False
        assert result.has_blocked_orgs is False

    def test_org_without_review(self) -> None:
        user = _build_user()
        org = _build_org(slug="my-org", review=None)

        result = collect_history_data(user, [org])

        assert len(result.prior_organizations) == 1
        assert result.prior_organizations[0].slug == "my-org"
        assert result.prior_organizations[0].review_verdict is None
        assert result.prior_organizations[0].appeal_decision is None

    def test_org_with_review_no_appeal(self) -> None:
        user = _build_user()
        review = _build_review(verdict="FAIL", appeal_decision=None)
        org = _build_org(slug="reviewed-org", review=review)

        result = collect_history_data(user, [org])

        assert len(result.prior_organizations) == 1
        assert result.prior_organizations[0].review_verdict == "FAIL"
        assert result.prior_organizations[0].appeal_decision is None

    def test_appeal_decision_as_plain_string(self) -> None:
        """Regression test for SERVER-44G: appeal_decision is a plain str from DB,
        not a StrEnum, so calling .value on it causes AttributeError."""
        user = _build_user()
        # SQLAlchemy loads String columns as plain str, not StrEnum
        review = _build_review(verdict="FAIL", appeal_decision="approved")
        org = _build_org(slug="appealed-org", review=review)

        result = collect_history_data(user, [org])

        assert result.prior_organizations[0].appeal_decision == "approved"

    def test_appeal_decision_as_enum(self) -> None:
        """Ensure it also works when the value is a StrEnum instance."""
        user = _build_user()
        review = _build_review(
            verdict=OrganizationReview.Verdict.FAIL,
            appeal_decision=OrganizationReview.AppealDecision.REJECTED,
        )
        org = _build_org(slug="enum-org", review=review)

        result = collect_history_data(user, [org])

        assert result.prior_organizations[0].review_verdict == "FAIL"
        assert result.prior_organizations[0].appeal_decision == "rejected"

    def test_denied_org_sets_has_prior_denials(self) -> None:
        user = _build_user()
        org = _build_org(status=OrganizationStatus.DENIED)

        result = collect_history_data(user, [org])

        assert result.has_prior_denials is True

    def test_blocked_org_sets_has_blocked_orgs(self) -> None:
        user = _build_user()
        org = _build_org(blocked_at=datetime(2024, 1, 1))

        result = collect_history_data(user, [org])

        assert result.has_blocked_orgs is True

    def test_user_blocked_at(self) -> None:
        blocked = datetime(2024, 6, 15)
        user = _build_user(blocked_at=blocked)

        result = collect_history_data(user, [])

        assert result.user_blocked_at == blocked

    def test_multiple_orgs(self) -> None:
        user = _build_user()
        review1 = _build_review(verdict="PASS")
        review2 = _build_review(verdict="FAIL", appeal_decision="rejected")

        org1 = _build_org(slug="org-1", review=review1)
        org2 = _build_org(
            slug="org-2",
            status=OrganizationStatus.DENIED,
            review=review2,
            blocked_at=datetime(2024, 3, 1),
        )

        result = collect_history_data(user, [org1, org2])

        assert len(result.prior_organizations) == 2
        assert result.prior_organizations[0].slug == "org-1"
        assert result.prior_organizations[0].review_verdict == "PASS"
        assert result.prior_organizations[1].slug == "org-2"
        assert result.prior_organizations[1].review_verdict == "FAIL"
        assert result.prior_organizations[1].appeal_decision == "rejected"
        assert result.has_prior_denials is True
        assert result.has_blocked_orgs is True
