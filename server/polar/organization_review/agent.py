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
    collect_identity_data,
    collect_metrics_data,
    collect_organization_data,
    collect_products_data,
    collect_website_data,
)
from .repository import OrganizationReviewRepository
from .schemas import (
    AccountData,
    AgentReviewResult,
    DataSnapshot,
    IdentityData,
    PaymentMetrics,
    ProductsData,
    ReviewContext,
)

log = structlog.get_logger(__name__)


async def run_organization_review(
    session: AsyncSession,
    organization: Organization,
    context: ReviewContext = ReviewContext.THRESHOLD,
) -> AgentReviewResult:
    start_time = time.monotonic()

    log.info(
        "organization_review.agent.start",
        organization_id=str(organization.id),
        slug=organization.slug,
        context=context.value,
    )

    try:
        snapshot = await _collect_data(session, organization, context)

        report, usage = await review_analyzer.analyze(snapshot, context=context)

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
    session: AsyncSession,
    organization: Organization,
    context: ReviewContext,
) -> DataSnapshot:
    org_repository = OrganizationRepository.from_session(session)
    review_repository = OrganizationReviewRepository.from_session(session)

    # Get admin user for history lookup
    admin_user = await org_repository.get_admin_user(session, organization)
    admin_user_id = admin_user.id if admin_user else None

    # Organization data (pure transformation, no DB query) — always collected
    org_data = collect_organization_data(organization)

    # Products — skip for SUBMISSION (no products exist yet)
    if context != ReviewContext.SUBMISSION:
        products = await review_repository.get_products_with_prices(organization.id)
        products_data = collect_products_data(products)
    else:
        products_data = ProductsData()

    # Payment metrics — collected for THRESHOLD and MANUAL reviews
    if context in (ReviewContext.THRESHOLD, ReviewContext.MANUAL):
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
    else:
        metrics_data = PaymentMetrics()

    # History — always collected
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

    # Account & Identity — skip for SUBMISSION (no Stripe account yet)
    if context != ReviewContext.SUBMISSION:
        account = (
            await review_repository.get_account_with_admin(organization.account_id)
            if organization.account_id
            else None
        )
        account_data = collect_account_data(account)
        identity_data = await collect_identity_data(account)
    else:
        account_data = AccountData()
        identity_data = IdentityData()

    # Website content (async I/O, non-fatal) — always collected
    website_data = None
    if organization.website:
        log.debug(
            "organization_review.website_collector.start",
            organization_id=str(organization.id),
            website_url=organization.website,
        )
        try:
            website_data = await collect_website_data(organization.website)
            log.debug(
                "organization_review.website_collector.complete",
                organization_id=str(organization.id),
                pages_scraped=website_data.total_pages_succeeded,
                scrape_error=website_data.scrape_error,
            )
        except Exception as e:
            log.warning(
                "organization_review.website_collector.failed",
                organization_id=str(organization.id),
                error=str(e),
            )

    return DataSnapshot(
        context=context,
        organization=org_data,
        products=products_data,
        identity=identity_data,
        account=account_data,
        metrics=metrics_data,
        history=history_data,
        website=website_data,
        collected_at=datetime.now(UTC),
    )
