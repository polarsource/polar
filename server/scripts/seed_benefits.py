"""Seed transaction-fee benefits and tier products via the Polar SDK.

Targets local, sandbox, or production. Lists existing benefits/products first
and only creates the ones that are missing (matched by description / name).

Usage:

    # Local (defaults to http://127.0.0.1:8000)
    POLAR_ACCESS_TOKEN=... uv run python -m scripts.seed_benefits --env local

    # Sandbox
    POLAR_ACCESS_TOKEN=... uv run python -m scripts.seed_benefits --env sandbox

    # Production
    POLAR_ACCESS_TOKEN=... uv run python -m scripts.seed_benefits --env prod

If you use a user (not organization) access token, pass --organization-id.

The ``BENEFITS`` and ``PRODUCTS`` lists below are the source of truth for the
Polar self-billing plan catalog and are also imported by the dev seed loader
(``scripts.seeds_load``) to materialize the same catalog directly in the DB.
"""

import asyncio
import os
from typing import Annotated

import typer
from polar_sdk import Polar
from polar_sdk.models import (
    Benefit,
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagCreateProperties,
    BenefitFeatureFlagUpdate,
    Product,
    ProductBenefitsUpdate,
    ProductCreateRecurring,
    ProductPriceFixedCreate,
    ProductPriceFreeCreate,
    ProductUpdate,
    ProductVisibility,
    SubscriptionRecurringInterval,
)

cli = typer.Typer(invoke_without_command=True)

LOCAL_SERVER_URL = "http://127.0.0.1:8000"

BENEFITS: list[dict[str, object]] = [
    {
        "description": "Transaction Fee (Tier 1)",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": 500,
            "fee_fixed": 50,
        },
    },
    {
        "description": "Transaction Fee (Tier 2)",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": 380,
            "fee_fixed": 35,
        },
    },
    {
        "description": "Transaction Fee (Tier 3)",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": 360,
            "fee_fixed": 30,
        },
    },
    {
        "description": "Transaction Fee (Tier 4)",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": 340,
            "fee_fixed": 30,
        },
    },
    {
        "description": "Transaction Fee (Grandfather)",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": 400,
            "fee_fixed": 40,
        },
    },
    {
        "description": "Support (Tier 1)",
        "metadata": {
            "type": "support",
            "level": 1,
            "slack": False,
            "prioritized": True,
            "plain_tier_external_id": "starter",
        },
    },
    {
        "description": "Support (Tier 2)",
        "metadata": {
            "type": "support",
            "level": 2,
            "slack": False,
            "prioritized": True,
            "plain_tier_external_id": "pro",
        },
    },
    {
        "description": "Support (Tier 3)",
        "metadata": {
            "type": "support",
            "level": 3,
            "slack": True,
            "prioritized": True,
            "plain_tier_external_id": "startup",
        },
    },
    {
        "description": "Support (Tier 4)",
        "metadata": {
            "type": "support",
            "level": 3,
            "slack": True,
            "prioritized": True,
            "plain_tier_external_id": "scale",
        },
    },
]

PRODUCTS: list[dict[str, object]] = [
    {
        "name": "Starter",
        "price_amount": None,
        "metadata": {
            "custom": False,
            "order": 1,
            "features": "All features to sell, Standard support",
        },
        "benefits": ["Transaction Fee (Tier 1)", "Support (Tier 1)"],
    },
    {
        "name": "Pro",
        "price_amount": 2000,
        "metadata": {
            "custom": False,
            "order": 2,
            "features": "Prioritized ticket support, Team permissions",
        },
        "benefits": ["Transaction Fee (Tier 2)", "Support (Tier 2)"],
    },
    {
        "name": "Startup",
        "price_amount": 10000,
        "metadata": {
            "custom": False,
            "order": 3,
            "highlight": True,
            "features": "Prioritized ticket support",
        },
        "benefits": ["Transaction Fee (Tier 3)", "Support (Tier 3)"],
    },
    {
        "name": "Scale",
        "price_amount": 40000,
        "metadata": {
            "custom": False,
            "order": 4,
            "features": "Slack & Prioritized Ticket support",
        },
        "benefits": ["Transaction Fee (Tier 4)", "Support (Tier 4)"],
    },
    {
        "name": "Early Adopter",
        "price_amount": None,
        "metadata": {"custom": False},
        "visibility": ProductVisibility.PRIVATE,
        "benefits": ["Transaction Fee (Grandfather)", "Support (Tier 1)"],
    },
]


def _make_client(env: str, token: str) -> Polar:
    if env == "local":
        return Polar(access_token=token, server_url=LOCAL_SERVER_URL)
    if env == "sandbox":
        return Polar(access_token=token, server="sandbox")
    if env == "prod":
        return Polar(access_token=token, server="production")
    raise typer.BadParameter(f"Unknown env: {env}")


async def _existing_benefits(
    polar: Polar, organization_id: str | None
) -> dict[str, Benefit]:
    by_description: dict[str, Benefit] = {}
    page = 1
    while True:
        response = await polar.benefits.list_async(
            page=page,
            limit=100,
            organization_id=organization_id,
        )
        if response is None:
            break
        for item in response.result.items:
            by_description[item.description] = item
        if len(response.result.items) < 100:
            break
        page += 1
    return by_description


async def _existing_products(
    polar: Polar, organization_id: str | None
) -> dict[str, Product]:
    by_name: dict[str, Product] = {}
    page = 1
    while True:
        response = await polar.products.list_async(
            page=page,
            limit=100,
            organization_id=organization_id,
        )
        if response is None:
            break
        for item in response.result.items:
            by_name[item.name] = item
        if len(response.result.items) < 100:
            break
        page += 1
    return by_name


async def _seed_benefits(
    polar: Polar, organization_id: str | None
) -> dict[str, Benefit]:
    typer.echo("Listing existing benefits...")
    existing = await _existing_benefits(polar, organization_id)
    typer.echo(f"Found {len(existing)} existing benefits.")

    for benefit in BENEFITS:
        description = benefit["description"]
        desired_metadata = benefit["metadata"]
        assert isinstance(description, str)
        assert isinstance(desired_metadata, dict)

        current = existing.get(description)
        if current is None:
            request = BenefitFeatureFlagCreate(
                description=description,
                properties=BenefitFeatureFlagCreateProperties(),
                metadata=desired_metadata,
                organization_id=organization_id,
            )
            created = await polar.benefits.create_async(request=request)
            existing[description] = created
            typer.echo(f"  create {description!r} -> {created.id}")
            continue

        current_metadata = dict(current.metadata or {})
        if current_metadata == desired_metadata:
            typer.echo(f"  skip   {description!r} (metadata matches)")
            continue

        update = BenefitFeatureFlagUpdate(metadata=desired_metadata)
        await polar.benefits.update_async(id=current.id, request_body=update)
        typer.echo(
            f"  update {description!r} -> {current.id} "
            f"(was {current_metadata}, now {desired_metadata})"
        )

    return existing


async def _seed_products(
    polar: Polar,
    organization_id: str | None,
    benefits_by_description: dict[str, Benefit],
) -> None:
    typer.echo("Listing existing products...")
    existing = await _existing_products(polar, organization_id)
    typer.echo(f"Found {len(existing)} existing products.")

    for product in PRODUCTS:
        name = product["name"]
        desired_metadata = product["metadata"]
        price_amount = product["price_amount"]
        benefit_descriptions = product["benefits"]
        desired_visibility = product.get("visibility", ProductVisibility.PUBLIC)
        assert isinstance(name, str)
        assert isinstance(desired_metadata, dict)
        assert isinstance(benefit_descriptions, list)
        assert price_amount is None or isinstance(price_amount, int)
        assert isinstance(desired_visibility, ProductVisibility)

        desired_benefit_ids: list[str] = []
        for description in benefit_descriptions:
            assert isinstance(description, str)
            benefit = benefits_by_description.get(description)
            if benefit is None:
                raise typer.BadParameter(
                    f"Product {name!r} references missing benefit "
                    f"{description!r}; seed benefits first."
                )
            desired_benefit_ids.append(benefit.id)

        current = existing.get(name)
        if current is None:
            price: ProductPriceFixedCreate | ProductPriceFreeCreate
            if price_amount is None:
                price = ProductPriceFreeCreate()
            else:
                price = ProductPriceFixedCreate(price_amount=price_amount)
            request = ProductCreateRecurring(
                name=name,
                recurring_interval=SubscriptionRecurringInterval.MONTH,
                prices=[price],
                metadata=desired_metadata,
                visibility=desired_visibility,
                organization_id=organization_id,
            )
            created = await polar.products.create_async(request=request)
            await polar.products.update_benefits_async(
                id=created.id,
                product_benefits_update=ProductBenefitsUpdate(
                    benefits=desired_benefit_ids
                ),
            )
            typer.echo(
                f"  create {name!r} -> {created.id} "
                f"with {len(desired_benefit_ids)} benefit(s)"
            )
            continue

        current_metadata = dict(current.metadata or {})
        current_visibility = current.visibility
        metadata_changed = current_metadata != desired_metadata
        visibility_changed = current_visibility != desired_visibility
        if metadata_changed or visibility_changed:
            product_update = ProductUpdate()
            if metadata_changed:
                product_update.metadata = desired_metadata
            if visibility_changed:
                product_update.visibility = desired_visibility
            await polar.products.update_async(
                id=current.id,
                product_update=product_update,
            )
            typer.echo(
                f"  update {name!r} -> {current.id} "
                f"(metadata was {current_metadata}, now {desired_metadata}; "
                f"visibility was {current_visibility}, now {desired_visibility})"
            )
        else:
            typer.echo(f"  skip   {name!r} (metadata and visibility match)")

        current_benefit_ids = sorted(b.id for b in current.benefits)
        if current_benefit_ids != sorted(desired_benefit_ids):
            await polar.products.update_benefits_async(
                id=current.id,
                product_benefits_update=ProductBenefitsUpdate(
                    benefits=desired_benefit_ids
                ),
            )
            typer.echo(
                f"  update {name!r} -> {current.id} benefits "
                f"(was {current_benefit_ids}, now {sorted(desired_benefit_ids)})"
            )


async def _seed(
    env: str,
    token: str,
    organization_id: str | None,
    seed_products: bool,
) -> None:
    polar = _make_client(env, token)
    typer.echo(f"Seeding on {env}...")
    benefits_by_description = await _seed_benefits(polar, organization_id)
    if seed_products:
        await _seed_products(polar, organization_id, benefits_by_description)
    else:
        typer.echo("Skipping products (pass --products to seed).")


@cli.callback()
def main(
    env: Annotated[
        str, typer.Option("--env", "-e", help="Target: local, sandbox, or prod.")
    ] = "local",
    token: Annotated[
        str | None,
        typer.Option(
            "--token",
            "-t",
            help="Polar access token. Falls back to $POLAR_ACCESS_TOKEN.",
        ),
    ] = None,
    organization_id: Annotated[
        str | None,
        typer.Option(
            "--organization-id",
            "-o",
            help="Organization ID. Required when using a user (not org) token.",
        ),
    ] = None,
    seed_products: Annotated[
        bool,
        typer.Option(
            "--products/--no-products",
            help="Also seed tier products and bind them to benefits.",
        ),
    ] = False,
) -> None:
    access_token = token or os.environ.get("POLAR_ACCESS_TOKEN")
    if not access_token:
        raise typer.BadParameter(
            "Missing access token: pass --token or set POLAR_ACCESS_TOKEN."
        )
    asyncio.run(_seed(env, access_token, organization_id, seed_products))


if __name__ == "__main__":
    cli()
