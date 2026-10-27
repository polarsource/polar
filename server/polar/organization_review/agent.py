import asyncio
import time
from datetime import UTC, datetime
from typing import cast
from urllib.parse import urlparse
from uuid import UUID

import structlog

from polar.kit.http import SSRFBlockedError, resolve_and_validate_ip
from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.payout_account import (
    collect_payout_account_data,
)
from polar.postgres import AsyncSession
from polar.worker import AsyncReadSessionMaker

from .analyzer import get_review_analyzer
from .collectors import (
    collect_feedback_data,
    collect_history_data,
    collect_identity_data,
    collect_metrics_data,
    collect_organization_data,
    collect_products_data,
    collect_risk_signal_data,
    collect_setup_data,
    collect_website_data,
)
from .collectors.setup import resolve_url_redirects, same_registrable_domain
from .known_domains import KnownDomainCategory, match_known_domain
from .repository import (
    OrganizationReviewRepository,
    OrganizationRiskSignalRepository,
)
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
    RiskSignalData,
    SetupData,
    UsageInfo,
    WebsiteData,
)

log = structlog.get_logger(__name__)

MAX_CHECKOUT_URL_HOSTS = 3
# Bounds the concurrent DNS lookups done before the crawl cap is applied.
_MAX_CHECKOUT_URL_HOST_CANDIDATES = 20
_HOSTING_CATEGORIES: set[KnownDomainCategory] = {
    "cloud",
    "no-code-builder",
    "tunneling",
}


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

        review_analyzer = get_review_analyzer()
        report, analyzer_usage = await review_analyzer.analyze(
            snapshot, context=context
        )

        duration = time.monotonic() - start_time

        collector_usage = UsageInfo()
        if snapshot.website and snapshot.website.usage:
            collector_usage = collector_usage + snapshot.website.usage
        if snapshot.setup.webhook_host and snapshot.setup.webhook_host.usage:
            collector_usage = collector_usage + snapshot.setup.webhook_host.usage
        for host_data in snapshot.setup.checkout_url_hosts:
            if host_data.usage:
                collector_usage = collector_usage + host_data.usage
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
    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        products = await repo.get_products_with_prices(organization_id)
        adhoc_prices_count = await repo.get_adhoc_price_count(organization_id)
        return collect_products_data(products, adhoc_prices_count=adhoc_prices_count)


async def _collect_setup(organization_id: UUID, context: ReviewContext) -> SetupData:
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
    if context not in (
        ReviewContext.THRESHOLD,
        ReviewContext.MANUAL,
        ReviewContext.PRODUCT_CHANGED,
    ):
        return PaymentMetrics()

    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        total, succeeded, amount = await repo.get_payment_stats(organization_id)
        p50, p90 = await repo.get_risk_score_percentiles(organization_id)
        refund_count, refund_amount = await repo.get_refund_stats(organization_id)
        dispute_count, dispute_amount = await repo.get_dispute_stats(organization_id)
        (
            chargeback_stop_count,
            chargeback_stop_amount,
        ) = await repo.get_chargeback_stop_stats(organization_id)
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
            chargeback_stop_count=chargeback_stop_count,
            chargeback_stop_amount_cents=chargeback_stop_amount,
        )


async def _collect_history(organization: Organization) -> HistoryData:
    async with AsyncReadSessionMaker() as session:
        org_repository = OrganizationRepository.from_session(session)
        review_repository = OrganizationReviewRepository.from_session(session)

        owner_user = await org_repository.get_owner_user(organization)
        owner_user_id = owner_user.id if owner_user else None

        user = (
            await review_repository.get_user_by_id(owner_user_id)
            if owner_user_id
            else None
        )
        other_orgs = (
            await review_repository.get_other_organizations_for_user(
                owner_user_id, organization.id
            )
            if owner_user_id
            else []
        )
        return collect_history_data(user, other_orgs)


async def _collect_account_identity(
    organization: Organization, context: ReviewContext
) -> tuple[PayoutAccountData, IdentityData]:
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
        website_data = await collect_website_data(
            organization.website,
            organization_id=str(organization.id),
            organization_slug=organization.slug,
        )
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


def _pick_unknown_webhook_host(
    organization: Organization, setup: SetupData
) -> str | None:
    """First webhook host that's worth fetching, or None.

    Skips hosts on the same registrable domain as the declared website, and
    hosts already classified as known integration platforms by the setup
    collector (`webhook_known_service_domains`).
    """
    declared = urlparse(organization.website or "").hostname or ""
    known = {d.lower() for d in setup.integration.webhook_known_service_domains}

    for host in setup.integration.webhook_domains:
        host_l = host.lower()
        if not host_l or host_l in known:
            continue
        if declared and same_registrable_domain(host_l, declared):
            continue
        return host_l
    return None


def _pick_checkout_url_hosts(organization: Organization, setup: SetupData) -> list[str]:
    """Hosts of checkout success/return URLs and their redirect destinations
    that are worth fetching, in priority order.

    Intermediate redirect hops are not included. Known hosting platforms are
    kept: a checkout URL on one is usually the merchant's own storefront.
    """
    declared = urlparse(organization.website or "").hostname or ""
    webhook_host = _pick_unknown_webhook_host(organization, setup)
    already_fetched = [h for h in (declared, webhook_host) if h]

    url_groups = (setup.checkout_success_urls, setup.checkout_return_urls)
    # Destinations of flagged chains first, so the crawl cap never drops them.
    candidate_urls = [
        r.final_url
        for group in url_groups
        for r in group.redirect_results
        if r.redirected and r.final_url
    ]
    for group in url_groups:
        candidate_urls.extend(group.unique_urls)

    picked: list[str] = []
    for url in candidate_urls:
        host = urlparse(url).hostname or ""
        if not host:
            continue
        known = match_known_domain(host)
        if known is not None and known.category not in _HOSTING_CATEGORIES:
            continue
        if any(same_registrable_domain(host, h) for h in [*already_fetched, *picked]):
            continue
        picked.append(host)
    return picked


async def _scrape_host(
    organization: Organization, host: str, *, log_event: str
) -> WebsiteData | None:
    log.debug(f"{log_event}.start", organization_id=str(organization.id), host=host)
    try:
        data = await collect_website_data(
            f"https://{host}/",
            organization_id=str(organization.id),
            organization_slug=organization.slug,
        )
        log.debug(
            f"{log_event}.complete",
            organization_id=str(organization.id),
            host=host,
            pages_scraped=data.total_pages_succeeded,
            scrape_error=data.scrape_error,
        )
        return data
    except Exception as e:
        log.warning(
            f"{log_event}.failed",
            organization_id=str(organization.id),
            host=host,
            error=str(e),
        )
        return None


async def _collect_webhook_host(
    organization: Organization, setup: SetupData
) -> WebsiteData | None:
    """Summarize the public site served on the webhook host when it differs
    from the declared website and isn't a known integration platform.
    """
    host = _pick_unknown_webhook_host(organization, setup)
    if host is None:
        return None
    return await _scrape_host(
        organization, host, log_event="organization_review.webhook_host_collector"
    )


async def _is_public_host(host: str) -> bool:
    try:
        await resolve_and_validate_ip(host)
    except SSRFBlockedError:
        return False
    return True


async def _collect_checkout_url_hosts(
    organization: Organization, setup: SetupData
) -> list[WebsiteData]:
    """Summarize what the sites behind checkout success/return URLs sell.

    Hosts resolving to private or reserved IPs are dropped before the
    `MAX_CHECKOUT_URL_HOSTS` cap, so they can't crowd out public ones.
    """
    candidates = _pick_checkout_url_hosts(organization, setup)[
        :_MAX_CHECKOUT_URL_HOST_CANDIDATES
    ]
    is_public = await asyncio.gather(*[_is_public_host(h) for h in candidates])
    hosts = [h for h, ok in zip(candidates, is_public) if ok][:MAX_CHECKOUT_URL_HOSTS]
    results = await asyncio.gather(
        *[
            _scrape_host(
                organization,
                host,
                log_event="organization_review.checkout_url_host_collector",
            )
            for host in hosts
        ]
    )
    return [r for r in results if r is not None]


async def _collect_prior_feedback(organization_id: UUID) -> PriorFeedbackData:
    async with AsyncReadSessionMaker() as session:
        repo = OrganizationReviewRepository.from_session(session)
        records = await repo.get_feedback_history(organization_id)
        return collect_feedback_data(records)


async def _collect_risk_signals(organization_id: UUID) -> RiskSignalData:
    async with AsyncReadSessionMaker() as session:
        repo = OrganizationRiskSignalRepository.from_session(session)
        signals = await repo.list_by_organization(organization_id)
        return collect_risk_signal_data(signals)


async def _collect_data(
    organization: Organization,
    context: ReviewContext,
) -> DataSnapshot:
    # Organization data — pure transformation, no I/O
    org_data = collect_organization_data(organization)

    # Run all collectors in parallel.
    # Each DB-bound collector creates its own session so queries
    # can execute concurrently across separate connections.
    #
    # _collect_setup runs first, then the webhook-host and checkout-URL-host
    # fetches chain off it inside the same parallel slot so they (~90s worst
    # case) don't serialize after the rest of the gather.
    async def _collect_setup_and_hosts() -> SetupData:
        setup = await _collect_setup(organization.id, context)
        (
            setup.webhook_host,
            setup.checkout_url_hosts,
        ) = await asyncio.gather(
            _collect_webhook_host(organization, setup),
            _collect_checkout_url_hosts(organization, setup),
        )
        return setup

    results = cast(
        tuple[
            ProductsData,
            SetupData,
            PaymentMetrics,
            HistoryData,
            tuple[PayoutAccountData, IdentityData],
            WebsiteData | None,
            PriorFeedbackData,
            RiskSignalData,
        ],
        await asyncio.gather(
            _collect_products(organization.id, context),
            _collect_setup_and_hosts(),
            _collect_metrics(organization.id, context),
            _collect_history(organization),
            _collect_account_identity(organization, context),
            _collect_website(organization),
            _collect_prior_feedback(organization.id),
            _collect_risk_signals(organization.id),
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
        risk_signal_data,
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
        risk_signals=risk_signal_data,
        collected_at=datetime.now(UTC),
    )
