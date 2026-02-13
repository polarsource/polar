from polar.models.organization import Organization, OrganizationStatus
from polar.models.user import User

from ..schemas import HistoryData, PriorOrganization


def collect_history_data(
    user: User | None,
    other_orgs: list[Organization],
) -> HistoryData:
    if user is None:
        return HistoryData()

    prior_organizations = []
    has_prior_denials = False
    has_blocked_orgs = False

    for org in other_orgs:
        review = org.review
        review_verdict = None
        appeal_decision = None

        if review is not None:
            review_verdict = review.verdict
            appeal_decision = (
                review.appeal_decision.value if review.appeal_decision else None
            )

        if org.status == OrganizationStatus.DENIED:
            has_prior_denials = True
        if org.blocked_at is not None:
            has_blocked_orgs = True

        prior_organizations.append(
            PriorOrganization(
                slug=org.slug,
                status=org.status.value,
                review_verdict=review_verdict,
                appeal_decision=appeal_decision,
                blocked_at=org.blocked_at,
            )
        )

    return HistoryData(
        user_email=user.email,
        user_blocked_at=user.blocked_at,
        prior_organizations=prior_organizations,
        has_prior_denials=has_prior_denials,
        has_blocked_orgs=has_blocked_orgs,
    )
