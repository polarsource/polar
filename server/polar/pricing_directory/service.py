from __future__ import annotations

import hashlib
import re
from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog

from polar.kit.utils import utc_now
from polar.models import (
    PricingCompany,
    PricingFeature,
    PricingMetric,
    PricingProduct,
    PricingSnapshot,
)
from polar.organization_review.collectors.firecrawl_client import (
    ScrapeResult,
    scrape_markdown,
)
from polar.postgres import AsyncReadSession, AsyncSession

from .extractor import PricingExtractor
from .feature_catalog import CATALOG_BY_KEY, FEATURE_CATALOG
from .repository import (
    PricingCompanyRepository,
    PricingFeatureRepository,
    PricingMetricRepository,
    PricingProductRepository,
    PricingSnapshotRepository,
)
from .schemas import (
    CatalogFeatureSchema,
    ChangeDirection,
    ExtractedPricing,
    ExtractedProduct,
    FeatureCategory,
    FeatureGatingRow,
    PriceComparisonRow,
    PricingChangeSchema,
    PricingFeatureRow,
)
from .seed import SEED_COMPANIES

log = structlog.get_logger(__name__)

# Below this, log and skip rather than record a dubious change.
MIN_CONFIDENCE = 0.5
_EXCERPT_CHARS = 500
_PRICE_RE = re.compile(r"\d[\d,]*\.?\d*")


def _content_hash(product: ExtractedProduct) -> str:
    metrics = sorted(
        f"{m.label}|{m.unit.value}|{m.amount}|{m.per_quantity}|{m.currency}"
        for m in product.metrics
    )
    features = sorted(f"{f.key.value}|{f.value or ''}" for f in product.features)
    others = sorted(product.other_features)
    payload = (
        f"{product.model.value}|{product.anchor}|{'~'.join(metrics)}"
        f"|{'~'.join(features)}|{'~'.join(others)}"
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _parse_price(anchor: str) -> float | None:
    match = _PRICE_RE.search(anchor.replace(",", ""))
    return float(match.group()) if match else None


def _anchor_price(anchor: str) -> float:
    """A sortable price for a plan's anchor: Free -> 0, custom/contact -> inf."""
    if "free" in anchor.lower():
        return 0.0
    parsed = _parse_price(anchor)
    return parsed if parsed is not None else float("inf")


def _direction(previous_anchor: str, new_anchor: str) -> ChangeDirection:
    previous = _parse_price(previous_anchor)
    current = _parse_price(new_anchor)
    if previous is None or current is None or previous == current:
        return ChangeDirection.new
    return ChangeDirection.up if current > previous else ChangeDirection.down


def _candidate_urls(url: str) -> list[str]:
    """Ordered pages to try for a company's pricing.

    A dedicated `/pricing` (then `/plans`) page is short, focused, and cheap to
    extract; the landing page is the noisy last resort.
    """
    base = url.rstrip("/")
    for suffix in ("/pricing", "/plans"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
    return [f"{base}/pricing", f"{base}/plans", base]


async def fetch_and_extract(
    company_name: str, url: str
) -> tuple[ScrapeResult, ExtractedPricing]:
    """Scrape pricing for a company, trying `/pricing`, then `/plans`, then the
    landing page. Returns the first page that yields products; skips the LLM on
    pages that 404."""
    extractor = PricingExtractor()
    best: tuple[ScrapeResult, ExtractedPricing] | None = None
    last_scrape: ScrapeResult | None = None

    for candidate in _candidate_urls(url):
        scrape = await scrape_markdown(candidate)
        last_scrape = scrape
        if scrape.status_code is not None and scrape.status_code >= 400:
            continue
        extracted = await extractor.extract(company_name, scrape.markdown)
        if extracted.products:
            log.info(
                "pricing_directory.scraped",
                url=candidate,
                products=len(extracted.products),
            )
            return scrape, extracted
        if best is None:
            best = (scrape, extracted)

    if best is not None:
        return best
    assert last_scrape is not None
    return last_scrape, ExtractedPricing(products=[], confidence=0.0)


class PricingDirectoryService:
    async def ensure_seed_companies(self, session: AsyncSession) -> None:
        repository = PricingCompanyRepository.from_session(session)
        for seed in SEED_COMPANIES:
            if await repository.get_by_slug(seed.slug) is not None:
                continue
            await repository.create(
                PricingCompany(
                    slug=seed.slug,
                    name=seed.name,
                    category=seed.category,
                    summary=seed.summary,
                    pricing_url=seed.pricing_url,
                )
            )

    async def list_company_ids(self, session: AsyncSession) -> Sequence[UUID]:
        repository = PricingCompanyRepository.from_session(session)
        companies = await repository.list_all()
        return [company.id for company in companies]

    async def list_companies(
        self, session: AsyncReadSession
    ) -> Sequence[PricingCompany]:
        repository = PricingCompanyRepository.from_session(session)
        return await repository.list_with_products()

    async def get_company(
        self, session: AsyncReadSession, slug: str
    ) -> PricingCompany | None:
        repository = PricingCompanyRepository.from_session(session)
        return await repository.get_detail(slug)

    async def list_recent_changes(
        self, session: AsyncReadSession, limit: int = 12
    ) -> list[PricingChangeSchema]:
        repository = PricingSnapshotRepository.from_session(session)
        snapshots = await repository.list_recent(limit)
        return [
            PricingChangeSchema(
                date=snapshot.captured_at,
                company=snapshot.product.company.name,
                company_slug=snapshot.product.company.slug,
                product=snapshot.product.name,
                model=snapshot.model,
                anchor=snapshot.anchor,
                direction=ChangeDirection(snapshot.direction),
            )
            for snapshot in snapshots
        ]

    async def scrape_company(
        self, session: AsyncSession, company_id: UUID
    ) -> None:
        company_repository = PricingCompanyRepository.from_session(session)
        company = await company_repository.get_by_id(company_id)
        if company is None:
            log.warning(
                "pricing_directory.company_missing", company_id=str(company_id)
            )
            return

        scrape, extracted = await fetch_and_extract(
            company.name, company.pricing_url
        )

        if extracted.confidence < MIN_CONFIDENCE:
            # Low-confidence extractions are where a human review queue belongs.
            log.warning(
                "pricing_directory.low_confidence",
                company=company.slug,
                confidence=extracted.confidence,
            )
            return

        for product in extracted.products:
            await self._apply_product(
                session, company, product, extracted.confidence, scrape.markdown
            )

        if extracted.products:
            # Products no longer on the page become "legacy" (kept, not deleted).
            await PricingProductRepository.from_session(
                session
            ).reconcile_status(
                company.id, [product.name for product in extracted.products]
            )

    async def _apply_product(
        self,
        session: AsyncSession,
        company: PricingCompany,
        product: ExtractedProduct,
        confidence: float,
        markdown: str,
    ) -> None:
        product_repository = PricingProductRepository.from_session(session)
        snapshot_repository = PricingSnapshotRepository.from_session(session)

        content_hash = _content_hash(product)
        now = utc_now()
        excerpt = markdown[:_EXCERPT_CHARS]

        existing = await product_repository.get_by_company_and_name(
            company.id, product.name
        )

        if existing is None:
            new_product = PricingProduct(
                company=company,
                name=product.name,
                current_model=product.model.value,
                current_anchor=product.anchor,
                last_direction=ChangeDirection.new.value,
                last_change_at=now,
                last_content_hash=content_hash,
            )
            await product_repository.create(new_product, flush=True)
            await snapshot_repository.create(
                PricingSnapshot(
                    product=new_product,
                    captured_at=now,
                    model=product.model.value,
                    anchor=product.anchor,
                    direction=ChangeDirection.new.value,
                    confidence=confidence,
                    source_excerpt=excerpt,
                )
            )
            await self._write_metrics(session, new_product, product)
            await self._write_features(session, new_product, product)
            return

        if existing.last_content_hash == content_hash:
            return  # nothing changed at all since last scrape

        # Only record a price snapshot when the price itself moved. Metric and
        # feature churn (the LLM phrasing them differently run to run) must not
        # create duplicate history rows.
        price_moved = (
            existing.current_model != product.model.value
            or existing.current_anchor != product.anchor
        )
        direction = _direction(existing.current_anchor, product.anchor)
        update_dict: dict[str, Any] = {"last_content_hash": content_hash}
        if price_moved:
            update_dict["current_model"] = product.model.value
            update_dict["current_anchor"] = product.anchor
            update_dict["last_direction"] = direction.value
            update_dict["last_change_at"] = now
        await product_repository.update(existing, update_dict=update_dict)
        if price_moved:
            await snapshot_repository.create(
                PricingSnapshot(
                    product=existing,
                    captured_at=now,
                    model=product.model.value,
                    anchor=product.anchor,
                    direction=direction.value,
                    confidence=confidence,
                    source_excerpt=excerpt,
                )
            )
        await self._write_metrics(session, existing, product)
        await self._write_features(session, existing, product)

    async def _write_metrics(
        self,
        session: AsyncSession,
        product: PricingProduct,
        extracted: ExtractedProduct,
    ) -> None:
        metric_repository = PricingMetricRepository.from_session(session)
        await metric_repository.delete_for_product(product.id)
        for metric in extracted.metrics:
            await metric_repository.create(
                PricingMetric(
                    product=product,
                    label=metric.label,
                    unit=metric.unit.value,
                    amount=metric.amount,
                    per_quantity=metric.per_quantity or 1,
                    currency=metric.currency or "USD",
                    raw=metric.raw,
                )
            )

    async def _write_features(
        self,
        session: AsyncSession,
        product: PricingProduct,
        extracted: ExtractedProduct,
    ) -> None:
        feature_repository = PricingFeatureRepository.from_session(session)
        await feature_repository.delete_for_product(product.id)
        seen: set[str] = set()
        for feature in extracted.features:
            catalog = CATALOG_BY_KEY.get(feature.key)
            if catalog is None or catalog.key.value in seen:
                continue
            seen.add(catalog.key.value)
            await feature_repository.create(
                PricingFeature(
                    product=product,
                    name=catalog.label,
                    key=catalog.key.value,
                    category=catalog.category.value,
                    value=feature.value,
                )
            )
        for name in extracted.other_features:
            await feature_repository.create(
                PricingFeature(
                    product=product,
                    name=name,
                    key="other",
                    category=FeatureCategory.other.value,
                    value=None,
                )
            )

    async def list_features(
        self,
        session: AsyncReadSession,
        *,
        category: str | None = None,
        key: str | None = None,
        query: str | None = None,
    ) -> list[PricingFeatureRow]:
        repository = PricingFeatureRepository.from_session(session)
        features = await repository.search(
            category=category, key=key, query=query
        )
        return [
            PricingFeatureRow(
                company=feature.product.company.name,
                company_slug=feature.product.company.slug,
                product=feature.product.name,
                anchor=feature.product.current_anchor,
                name=feature.name,
                key=feature.key,
                category=feature.category,
                value=feature.value,
            )
            for feature in features
        ]

    def catalog(self) -> list[CatalogFeatureSchema]:
        return [
            CatalogFeatureSchema(
                key=feature.key.value,
                label=feature.label,
                category=feature.category.value,
            )
            for feature in FEATURE_CATALOG
        ]

    async def feature_gating(
        self, session: AsyncReadSession, key: str
    ) -> list[FeatureGatingRow]:
        repository = PricingFeatureRepository.from_session(session)
        features = await repository.search(key=key)

        # Keep the cheapest plan per company that includes the feature.
        cheapest: dict[str, tuple[float, FeatureGatingRow]] = {}
        for feature in features:
            product = feature.product
            slug = product.company.slug
            price = _anchor_price(product.current_anchor)
            row = FeatureGatingRow(
                company=product.company.name,
                company_slug=slug,
                plan=product.name,
                anchor=product.current_anchor,
                value=feature.value,
            )
            if slug not in cheapest or price < cheapest[slug][0]:
                cheapest[slug] = (price, row)

        return [
            row for _, row in sorted(cheapest.values(), key=lambda item: item[0])
        ]

    async def list_metrics(
        self,
        session: AsyncReadSession,
        *,
        unit: str | None = None,
        query: str | None = None,
    ) -> list[PriceComparisonRow]:
        repository = PricingMetricRepository.from_session(session)
        metrics = await repository.search(unit=unit, query=query)
        return [
            PriceComparisonRow(
                company=metric.product.company.name,
                company_slug=metric.product.company.slug,
                product=metric.product.name,
                label=metric.label,
                unit=metric.unit,
                amount=metric.amount,
                per_quantity=metric.per_quantity,
                currency=metric.currency,
                unit_price=metric.amount / metric.per_quantity,
            )
            for metric in metrics
        ]


pricing_directory = PricingDirectoryService()
