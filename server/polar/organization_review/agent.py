import asyncio
import time
from datetime import UTC, datetime
from uuid import UUID

import structlog

from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.worker import AsyncReadSessionMaker

from .analyzer import review_analyzer
from .collectors import (
    collect_account_data,
    collect_history_data,
    collect_identity_data,
    collect_metrics_data,
    collect_organization_data,
    collect_products_data,
    collect_setup_data,
    collect_website_data,
)
from .repository import OrganizationReviewRepository
from .schemas import (
    AccountData,
    AgentReviewResult,
    DataSnapshot,
    HistoryData,
    IdentityData,
    PaymentMetrics,
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


async def _collect_products(
    organization_id: UUID, context: ReviewContext
) -> ProductsData:
    if context == ReviewContext.SUBMISSION:
        return ProductsData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        products = await repo.get_products_with_prices(organization_id)
        return collect_products_data(products)


async def _collect_setup(organization_id: UUID, context: ReviewContext) -> SetupData:
    if context == ReviewContext.SUBMISSION:
        return SetupData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        checkout_links = await repo.get_checkout_links_with_benefits(organization_id)
        api_key_count = await repo.get_api_key_count(organization_id)
        webhook_endpoints = await repo.get_webhook_endpoints(organization_id)
        return collect_setup_data(checkout_links, api_key_count, webhook_endpoints)


async def _collect_metrics(
    organization_id: UUID, context: ReviewContext
) -> PaymentMetrics:
    if context not in (ReviewContext.THRESHOLD, ReviewContext.MANUAL):
        return PaymentMetrics()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        total, succeeded, amount = await repo.get_payment_stats(organization_id)
        risk_scores = await repo.get_risk_scores(organization_id)
        refund_count, refund_amount = await repo.get_refund_stats(organization_id)
        dispute_count, dispute_amount = await repo.get_dispute_stats(organization_id)
        return collect_metrics_data(
            total_payments=total,
            succeeded_payments=succeeded,
            total_amount_cents=amount,
            risk_scores=risk_scores,
            refund_count=refund_count,
            refund_amount_cents=refund_amount,
            dispute_count=dispute_count,
            dispute_amount_cents=dispute_amount,
        )


async def _collect_history(organization: Organization) -> HistoryData:
    async with AsyncReadSessionMaker() as session:
        org_repository = OrganizationRepository.from_session(session)
        review_repository = OrganizationReviewRepository.from_session(session)

        admin_user = await org_repository.get_admin_user(session, organization)
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
) -> tuple[AccountData, IdentityData]:
    if context == ReviewContext.SUBMISSION:
        return AccountData(), IdentityData()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        account = (
            await repo.get_account_with_admin(organization.account_id)
            if organization.account_id
            else None
        )
    account_data = collect_account_data(account)
    identity_data = await collect_identity_data(account)
    return account_data, identity_data


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


async def _collect_data(
    organization: Organization,
    context: ReviewContext,
) -> DataSnapshot:
    # Organization data — pure transformation, no I/O
    org_data = collect_organization_data(organization)

    # Run all collectors in parallel.
    # Each DB-bound collector creates its own session so queries
    # can execute concurrently across separate connections.
    (
        products_data,
        setup_data,
        metrics_data,
        history_data,
        (account_data, identity_data),
        website_data,
    ) = await asyncio.gather(
        _collect_products(organization.id, context),
        _collect_setup(organization.id, context),
        _collect_metrics(organization.id, context),
        _collect_history(organization),
        _collect_account_identity(organization, context),
        _collect_website(organization),
    )

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
        collected_at=datetime.now(UTC),
    )
