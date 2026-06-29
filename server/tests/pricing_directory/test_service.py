from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.models import PricingCompany
from polar.organization_review.collectors.firecrawl_client import ScrapeResult
from polar.pricing_directory.repository import (
    PricingProductRepository,
    PricingSnapshotRepository,
)
from polar.pricing_directory.schemas import (
    ExtractedPricing,
    ExtractedProduct,
    PricingModelType,
)
from polar.pricing_directory.service import pricing_directory
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _scrape() -> ScrapeResult:
    return ScrapeResult(
        markdown="pricing page",
        url="https://acme.test/pricing",
        status_code=200,
        title="Acme",
    )


def _pricing(anchor: str, *, confidence: float = 0.9) -> ExtractedPricing:
    return ExtractedPricing(
        products=[
            ExtractedProduct(
                name="API", model=PricingModelType.usage, anchor=anchor
            )
        ],
        confidence=confidence,
    )


async def _company(save_fixture: SaveFixture) -> PricingCompany:
    company = PricingCompany(
        slug="acme",
        name="Acme",
        category="AI",
        summary=None,
        pricing_url="https://acme.test/pricing",
    )
    await save_fixture(company)
    return company


def _mock_pipeline(
    mocker: MockerFixture, extract_return: object
) -> None:
    mocker.patch(
        "polar.pricing_directory.service.scrape_markdown",
        new=AsyncMock(return_value=_scrape()),
    )
    extractor = mocker.MagicMock()
    extractor.extract = AsyncMock()
    if isinstance(extract_return, list):
        extractor.extract.side_effect = extract_return
    else:
        extractor.extract.return_value = extract_return
    mocker.patch(
        "polar.pricing_directory.service.PricingExtractor",
        return_value=extractor,
    )


@pytest.mark.asyncio
class TestScrapeCompany:
    async def test_creates_product_and_snapshot(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        company = await _company(save_fixture)
        _mock_pipeline(mocker, _pricing("$5.00 / M tokens"))

        await pricing_directory.scrape_company(session, company.id)

        products = await PricingProductRepository.from_session(
            session
        ).list_for_company(company.id)
        assert len(products) == 1
        assert products[0].current_anchor == "$5.00 / M tokens"
        assert products[0].last_direction == "new"
        snapshots = await PricingSnapshotRepository.from_session(
            session
        ).list_for_product(products[0].id)
        assert len(snapshots) == 1

    async def test_records_change_on_price_move(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        company = await _company(save_fixture)
        _mock_pipeline(
            mocker,
            [_pricing("$5.00 / M tokens"), _pricing("$2.50 / M tokens")],
        )

        await pricing_directory.scrape_company(session, company.id)
        await pricing_directory.scrape_company(session, company.id)

        product = (
            await PricingProductRepository.from_session(session).list_for_company(
                company.id
            )
        )[0]
        assert product.current_anchor == "$2.50 / M tokens"
        assert product.last_direction == "down"
        snapshots = await PricingSnapshotRepository.from_session(
            session
        ).list_for_product(product.id)
        assert len(snapshots) == 2

    async def test_no_snapshot_when_unchanged(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        company = await _company(save_fixture)
        _mock_pipeline(
            mocker,
            [_pricing("$5.00 / M tokens"), _pricing("$5.00 / M tokens")],
        )

        await pricing_directory.scrape_company(session, company.id)
        await pricing_directory.scrape_company(session, company.id)

        product = (
            await PricingProductRepository.from_session(session).list_for_company(
                company.id
            )
        )[0]
        snapshots = await PricingSnapshotRepository.from_session(
            session
        ).list_for_product(product.id)
        assert len(snapshots) == 1

    async def test_low_confidence_is_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        company = await _company(save_fixture)
        _mock_pipeline(mocker, _pricing("$5.00 / M tokens", confidence=0.1))

        await pricing_directory.scrape_company(session, company.id)

        products = await PricingProductRepository.from_session(
            session
        ).list_for_company(company.id)
        assert len(products) == 0
