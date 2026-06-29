"""Run the pricing-directory scraper against an arbitrary URL.

Local testing helper: fetches a pricing page via Firecrawl and runs the LLM
extractor, printing the products it finds. Does **not** touch the database, so
it is safe to run repeatedly while iterating on the extraction prompt.

Usage:

    uv run python -m scripts.scrape_pricing https://linear.app/pricing
    uv run python -m scripts.scrape_pricing https://example.com/pricing --company "Example"
    uv run python -m scripts.scrape_pricing https://linear.app/pricing --json

Requires FIRECRAWL_API_KEY and PYDANTIC_AI_GATEWAY_* in the environment (the
same keys the account-review scraper uses).
"""

import asyncio
from urllib.parse import urlparse

import typer

from polar.pricing_directory.service import fetch_and_extract

cli = typer.Typer()


def _default_company(url: str) -> str:
    host = urlparse(url).netloc.removeprefix("www.")
    return host.split(".")[0].capitalize() or host


@cli.command()
def main(
    url: str = typer.Argument(..., help="Pricing page URL to scrape."),
    company: str | None = typer.Option(
        None, "--company", help="Company name (defaults to the URL host)."
    ),
    json_output: bool = typer.Option(
        False, "--json", help="Print the raw extracted JSON instead of a summary."
    ),
) -> None:
    """Fetch and extract pricing from URL. Does not write to the database."""
    name = company or _default_company(url)
    scrape, extracted = asyncio.run(fetch_and_extract(name, url))

    if json_output:
        typer.echo(extracted.model_dump_json(indent=2))
        return

    typer.echo(
        f"Fetched {len(scrape.markdown)} chars from {scrape.url} "
        f"(status {scrape.status_code})"
    )
    typer.echo(f"Company: {name}")
    typer.echo(f"Confidence: {extracted.confidence}")
    if not extracted.products:
        typer.echo("No products found.")
    for product in extracted.products:
        typer.echo(f"  - {product.name}: {product.model.value} / {product.anchor}")


if __name__ == "__main__":
    cli()
