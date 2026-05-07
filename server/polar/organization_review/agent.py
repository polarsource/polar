import asyncio
import time
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import structlog

from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.payout_account import (
    collect_payout_account_data,
)
from polar.postgres import AsyncSession
from polar.worker import AsyncReadSessionMaker

from .analyzer import review_analyzer
from .collectors import (
    collect_feedback_data,
    collect_history_data,
    collect_identity_data,
    collect_metrics_data,
    collect_organization_data,
    collect_products_data,
    collect_setup_data,
    collect_website_data,
)
from .collectors.setup import resolve_url_redirects
from .repository import OrganizationReviewRepository
from .schemas import (
    AgentReviewResult,
    DataSnapshot,
    HistoryData,
    IdentityData,
    PaymentMetrics,
    PayoutAccountData,
    PriorFeedbackData,
    ProductsData,
    ReviewContext,
    SetupData,
    UsageInfo,
    WebsiteData,
)

log = structlog.get_logger(__name__)


async def run_organization_review(
    session: AsyncSession,
    organization: Organization,
    context: ReviewContext = ReviewContext.THRESHOLD,
    appeal_reason: str | None = None,
    original_denial_reason: str | None = None,
) -> AgentReviewResult:
    start_time = time.monotonic()

    log.info(
        "organization_review.agent.start",
        organization_id=str(organization.id),
        slug=organization.slug,
        context=context.value,
    )

    try:
        snapshot = await _collect_data(organization, context)
        appeal_updates: dict[str, str] = {}
        if appeal_reason is not None:
            appeal_updates["appeal_reason"] = appeal_reason
        if original_denial_reason is not None:
            appeal_updates["original_denial_reason"] = original_denial_reason
        if appeal_updates:
            snapshot = snapshot.model_copy(update=appeal_updates)

        report, analyzer_usage = await review_analyzer.analyze(
            snapshot, context=context
        )

        duration = time.monotonic() - start_time

        collector_usage = (
            snapshot.website.usage
            if snapshot.website and snapshot.website.usage
            else UsageInfo()
        )
        usage = analyzer_usage + collector_usage

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
            model_used=review_analyzer.model_name,
            model_provider=review_analyzer.model_provider,
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


async def _collect_products(
    organization_id: UUID, context: ReviewContext
) -> ProductsData:
    if context == ReviewContext.SUBMISSION:
        return ProductsData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        products = await repo.get_products_with_prices(organization_id)
        adhoc_prices_count = await repo.get_adhoc_price_count(organization_id)
        return collect_products_data(products, adhoc_prices_count=adhoc_prices_count)


async def _collect_setup(organization_id: UUID, context: ReviewContext) -> SetupData:
    if context not in (ReviewContext.THRESHOLD, ReviewContext.MANUAL):
        return SetupData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        checkout_links = await repo.get_checkout_links_with_benefits(organization_id)
        checkout_return_urls = await repo.get_checkout_return_urls(organization_id)
        checkout_success_urls = await repo.get_checkout_success_urls(organization_id)
        api_key_count = await repo.get_api_key_count(organization_id)
        webhook_endpoints = await repo.get_webhook_endpoints(organization_id)

    # Collect all unique success URLs (from links + checkouts) for redirect checks
    all_success_urls: list[str] = []
    seen: set[str] = set()
    for link in checkout_links:
        if link.success_url and link.success_url not in seen:
            seen.add(link.success_url)
            all_success_urls.append(link.success_url)
    for url in checkout_success_urls:
        if url not in seen:
            seen.add(url)
            all_success_urls.append(url)

    # Resolve redirects on success and return URLs in parallel
    success_redirects, return_redirects = await asyncio.gather(
        resolve_url_redirects(all_success_urls),
        resolve_url_redirects(checkout_return_urls),
    )

    return collect_setup_data(
        checkout_links,
        checkout_return_urls,
        checkout_success_urls,
        api_key_count,
        webhook_endpoints,
        success_url_redirects=success_redirects,
        return_url_redirects=return_redirects,
    )


async def _collect_metrics(
    organization_id: UUID, context: ReviewContext
) -> PaymentMetrics:
    if context not in (ReviewContext.THRESHOLD, ReviewContext.MANUAL):
        return PaymentMetrics()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        total, succeeded, amount = await repo.get_payment_stats(organization_id)
        p50, p90 = await repo.get_risk_score_percentiles(organization_id)
        refund_count, refund_amount = await repo.get_refund_stats(organization_id)
        dispute_count, dispute_amount = await repo.get_dispute_stats(organization_id)
        return collect_metrics_data(
            total_payments=total,
            succeeded_payments=succeeded,
            total_amount_cents=amount,
            p50_risk_score=p50,
            p90_risk_score=p90,
            refund_count=refund_count,
            refund_amount_cents=refund_amount,
            dispute_count=dispute_count,
            dispute_amount_cents=dispute_amount,
        )


async def _collect_history(organization: Organization) -> HistoryData:
    async with AsyncReadSessionMaker() as session:
        org_repository = OrganizationRepository.from_session(session)
        review_repository = OrganizationReviewRepository.from_session(session)

        admin_user = await org_repository.get_admin_user(organization)
        admin_user_id = admin_user.id if admin_user else None

        user = (
            await review_repository.get_user_by_id(admin_user_id)
            if admin_user_id
            else None
        )
        other_orgs = (
            await review_repository.get_other_organizations_for_user(
                admin_user_id, organization.id
            )
            if admin_user_id
            else []
        )
        return collect_history_data(user, other_orgs)


async def _collect_account_identity(
    organization: Organization, context: ReviewContext
) -> tuple[PayoutAccountData, IdentityData]:
    if context == ReviewContext.SUBMISSION:
        return PayoutAccountData(), IdentityData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        payout_account = await repo.get_payout_account_with_admin(organization.id)
    payout_account_data = collect_payout_account_data(payout_account)
    identity_data = await collect_identity_data(
        payout_account.admin if payout_account is not None else None
    )
    return payout_account_data, identity_data


async def _collect_website(organization: Organization) -> WebsiteData | None:
    if not organization.website:
        return None

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
        return website_data
    except Exception as e:
        log.warning(
            "organization_review.website_collector.failed",
            organization_id=str(organization.id),
            error=str(e),
        )
        return None


async def _collect_prior_feedback(organization_id: UUID) -> PriorFeedbackData:
    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        records = await repo.get_feedback_history(organization_id)
        return collect_feedback_data(records)


async def _collect_data(
    organization: Organization,
    context: ReviewContext,
) -> DataSnapshot:
    # Organization data — pure transformation, no I/O
    org_data = collect_organization_data(organization)

    # Run all collectors in parallel.
    # Each DB-bound collector creates its own session so queries
    # can execute concurrently across separate connections.
    results = cast(
        tuple[
            ProductsData,
            SetupData,
            PaymentMetrics,
            HistoryData,
            tuple[PayoutAccountData, IdentityData],
            WebsiteData | None,
            PriorFeedbackData,
        ],
        await asyncio.gather(
            _collect_products(organization.id, context),
            _collect_setup(organization.id, context),
            _collect_metrics(organization.id, context),
            _collect_history(organization),
            _collect_account_identity(organization, context),
            _collect_website(organization),
            _collect_prior_feedback(organization.id),
        ),
    )
    (
        products_data,
        setup_data,
        metrics_data,
        history_data,
        (account_data, identity_data),
        website_data,
        prior_feedback_data,
    ) = results

    return DataSnapshot(
        context=context,
        organization=org_data,
        products=products_data,
        identity=identity_data,
        account=account_data,
        metrics=metrics_data,
        history=history_data,
        setup=setup_data,
        website=website_data,
        prior_feedback=prior_feedback_data,
        collected_at=datetime.now(UTC),
    )
