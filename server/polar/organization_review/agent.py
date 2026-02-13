import time
from datetime import UTC, datetime

import structlog

from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession

from .analyzer import review_analyzer
from .collectors import (
    collect_account_data,
    collect_history_data,
    collect_metrics_data,
    collect_organization_data,
    collect_products_data,
)
from .repository import OrganizationReviewRepository
from .schemas import AgentReviewResult, DataSnapshot

log = structlog.get_logger(__name__)


async def run_organization_review(
    session: AsyncSession, organization: Organization
) -> AgentReviewResult:
    start_time = time.monotonic()

    log.info(
        "organization_review.agent.start",
        organization_id=str(organization.id),
        slug=organization.slug,
    )

    try:
        snapshot = await _collect_data(session, organization)

        report, usage = await review_analyzer.analyze(snapshot)

        duration = time.monotonic() - start_time

        log.info(
            "organization_review.agent.complete",
            organization_id=str(organization.id),
            slug=organization.slug,
            verdict=report.verdict.value,
            risk_score=report.overall_risk_score,
            duration_seconds=round(duration, 2),
        )

        return AgentReviewResult(
            report=report,
            data_snapshot=snapshot,
            model_used=review_analyzer.model.model_name,
            duration_seconds=round(duration, 2),
            usage=usage,
        )

    except Exception as e:
        duration = time.monotonic() - start_time
        log.error(
            "organization_review.agent.error",
            organization_id=str(organization.id),
            slug=organization.slug,
            error=str(e),
            duration_seconds=round(duration, 2),
        )
        raise


async def _collect_data(
    session: AsyncSession, organization: Organization
) -> DataSnapshot:
    org_repository = OrganizationRepository.from_session(session)
    review_repository = OrganizationReviewRepository.from_session(session)

    # Get admin user for history lookup
    admin_user = await org_repository.get_admin_user(session, organization)
    admin_user_id = admin_user.id if admin_user else None

    # Organization data (pure transformation, no DB query)
    org_data = collect_organization_data(organization)

    # Products (DB query via repository, then transform)
    products = await review_repository.get_products_with_prices(organization.id)
    products_data = collect_products_data(products)

    # Payment metrics (multiple DB queries via repository, then transform)
    total, succeeded, amount = await review_repository.get_payment_stats(
        organization.id
    )
    risk_scores = await review_repository.get_risk_scores(organization.id)
    refund_count, refund_amount = await review_repository.get_refund_stats(
        organization.id
    )
    dispute_count, dispute_amount = await review_repository.get_dispute_stats(
        organization.id
    )
    metrics_data = collect_metrics_data(
        total_payments=total,
        succeeded_payments=succeeded,
        total_amount_cents=amount,
        risk_scores=risk_scores,
        refund_count=refund_count,
        refund_amount_cents=refund_amount,
        dispute_count=dispute_count,
        dispute_amount_cents=dispute_amount,
    )

    # History (DB queries via repository, then transform)
    user = (
        await review_repository.get_user_by_id(admin_user_id) if admin_user_id else None
    )
    other_orgs = (
        await review_repository.get_other_organizations_for_user(
            admin_user_id, organization.id
        )
        if admin_user_id
        else []
    )
    history_data = collect_history_data(user, other_orgs)

    # Account (DB query via repository, then transform)
    account = (
        await review_repository.get_account_with_admin(organization.account_id)
        if organization.account_id
        else None
    )
    account_data = collect_account_data(account)

    return DataSnapshot(
        organization=org_data,
        products=products_data,
        account=account_data,
        metrics=metrics_data,
        history=history_data,
        collected_at=datetime.now(UTC),
    )
