"""Bulk-scrape pricing for companies in the directory and persist to the DB.

Ensures all seed companies exist, then scrapes (in parallel, with a concurrency
cap) every company that has no products yet. Pass --rescrape to re-scrape all
companies, not just the empty ones.

Usage:

    uv run python -m scripts.scrape_directory
    uv run python -m scripts.scrape_directory --concurrency 8
    uv run python -m scripts.scrape_directory --rescrape

Requires FIRECRAWL_API_KEY and PYDANTIC_AI_GATEWAY_* in the environment, and a
reachable database (migrations applied).
"""

import asyncio
import uuid

import typer

from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.pricing_directory.repository import PricingCompanyRepository
from polar.pricing_directory.service import pricing_directory

cli = typer.Typer()


async def _run(concurrency: int, rescrape: bool) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            await pricing_directory.ensure_seed_companies(session)
            await session.commit()
            companies = await PricingCompanyRepository.from_session(
                session
            ).list_with_products()
            targets: list[tuple[uuid.UUID, str]] = [
                (company.id, company.name)
                for company in companies
                if rescrape or len(company.products) == 0
            ]

        typer.echo(
            f"{len(targets)} companies to scrape "
            f"(of {len(companies)} total, concurrency {concurrency})"
        )
        if not targets:
            return

        semaphore = asyncio.Semaphore(concurrency)

        async def scrape_one(company_id: uuid.UUID, name: str) -> None:
            async with semaphore:
                async with sessionmaker() as session:
                    try:
                        await pricing_directory.scrape_company(
                            session, company_id
                        )
                        await session.commit()
                        typer.echo(f"  ok    {name}")
                    except Exception as error:
                        await session.rollback()
                        detail = f"{type(error).__name__}: {error}"
                        typer.echo(f"  fail  {name}: {detail[:140]}")

        await asyncio.gather(
            *(scrape_one(company_id, name) for company_id, name in targets)
        )
    finally:
        await engine.dispose()


@cli.command()
def main(
    concurrency: int = typer.Option(
        6, help="Maximum number of companies to scrape at once."
    ),
    rescrape: bool = typer.Option(
        False, "--rescrape", help="Re-scrape all companies, not just empty ones."
    ),
) -> None:
    """Scrape pricing for directory companies and persist the results."""
    asyncio.run(_run(concurrency, rescrape))


if __name__ == "__main__":
    cli()
