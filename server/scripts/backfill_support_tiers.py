import uuid
from collections import defaultdict
from dataclasses import dataclass, field

import typer
from polar_sdk import Polar
from polar_sdk.models import Benefit, BenefitGrant

from polar.config import settings
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_sessionmaker,
)
from polar.models.organization import SupportTier
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@dataclass
class BackfillResult:
    tiers_set: int = 0
    untiered_skipped: int = 0
    not_found_skipped: int = 0
    errors: int = 0
    error_details: list[tuple[str, str]] = field(default_factory=list)


def resolve_tiers(
    benefit_tiers: dict[str, SupportTier | None],
    grants: list[BenefitGrant],
) -> tuple[dict[uuid.UUID, SupportTier], BackfillResult]:
    """Group active support grants by organization and resolve each org's tier.

    Mirrors the benefit-grant webhook's invariant that a customer holds at most
    one active support grant: an org with more than one (across any support
    benefit, any level) is flagged as an error rather than silently resolved.
    An org whose single grant maps to no known tier is skipped — its column
    stays NULL, like a free org.
    """
    result = BackfillResult()
    resolved: dict[uuid.UUID, SupportTier] = {}

    grants_by_external_id: dict[str, list[BenefitGrant]] = defaultdict(list)
    for grant in grants:
        external_id = grant.customer.external_id
        if not isinstance(external_id, str) or not external_id:
            result.errors += 1
            result.error_details.append(
                (grant.id, f"grant {grant.id} customer has no external_id")
            )
            continue
        grants_by_external_id[external_id].append(grant)

    for external_id, organization_grants in grants_by_external_id.items():
        if len(organization_grants) > 1:
            benefit_ids = [grant.benefit_id for grant in organization_grants]
            result.errors += 1
            result.error_details.append(
                (
                    external_id,
                    f"holds {len(organization_grants)} active support grants, "
                    f"expected at most 1: {benefit_ids}",
                )
            )
            continue

        tier = benefit_tiers.get(organization_grants[0].benefit_id)
        if tier is None:
            result.untiered_skipped += 1
            continue

        try:
            organization_id = uuid.UUID(external_id)
        except ValueError:
            result.errors += 1
            result.error_details.append(
                (external_id, "customer external_id is not a UUID")
            )
            continue

        resolved[organization_id] = tier

    return resolved, result


async def _list_support_benefits(sdk: Polar) -> list[Benefit]:
    benefits: list[Benefit] = []
    response = await sdk.benefits.list_async(
        organization_id=settings.POLAR_ORGANIZATION_ID,
        metadata={"type": "support"},
        page=1,
        limit=100,
    )
    while response is not None:
        benefits.extend(response.result.items)
        response = response.next()
    return benefits


async def _list_benefit_grants(sdk: Polar, benefit_id: str) -> list[BenefitGrant]:
    grants: list[BenefitGrant] = []
    response = await sdk.benefits.grants_async(
        id=benefit_id,
        is_granted=True,
        page=1,
        limit=100,
    )
    while response is not None:
        grants.extend(response.result.items)
        response = response.next()
    return grants


def _benefit_tier(benefit: Benefit) -> SupportTier | None:
    level, _, _, _ = polar_self_service._extract_support(
        benefit.metadata or {}, benefit.id
    )
    return SupportTier.from_level(level)


async def run_backfill(
    *,
    sessionmaker: AsyncSessionMaker,
    dry_run: bool = False,
) -> BackfillResult:
    sdk = Polar(
        access_token=settings.POLAR_ACCESS_TOKEN,
        server_url=settings.POLAR_API_URL,
    )
    self_org_external_id = settings.POLAR_ORGANIZATION_ID

    typer.echo("Loading support benefits...")
    support_benefits = await _list_support_benefits(sdk)
    typer.echo(f"Found {len(support_benefits)} support benefit(s)")

    benefit_tiers = {benefit.id: _benefit_tier(benefit) for benefit in support_benefits}

    grants: list[BenefitGrant] = []
    for benefit in support_benefits:
        grants.extend(await _list_benefit_grants(sdk, benefit.id))
    # Defensively skip the Polar org's own customer if it ever holds a grant.
    grants = [
        grant for grant in grants if grant.customer.external_id != self_org_external_id
    ]
    typer.echo(f"Found {len(grants)} active support grant(s)")

    resolved, result = resolve_tiers(benefit_tiers, grants)

    async with sessionmaker() as session:
        repository = OrganizationRepository.from_session(session)
        for organization_id, tier in resolved.items():
            organization = await repository.get_by_id(
                organization_id, include_blocked=True
            )
            if organization is None:
                result.not_found_skipped += 1
                continue
            if dry_run:
                typer.echo(
                    f"  Would set {organization.name} ({organization_id}) "
                    f"-> {tier.get_display_name()}"
                )
            else:
                organization.support_tier = tier
            result.tiers_set += 1
        if not dry_run:
            await session.commit()

    return result


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        True, help="Print what would be set without writing to the database"
    ),
) -> None:
    """Backfill Organization.support_tier from active Polar support grants.

    The benefit-grant webhook only fires on future grant changes, so existing
    paying orgs need this one-off pass. It reads from the support benefits'
    active grants — never the full organizations table. Free/untiered orgs stay
    NULL (the column default).
    """
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting."
        )
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        result = await run_backfill(sessionmaker=sessionmaker, dry_run=dry_run)

        typer.echo(
            f"\nDone: {result.tiers_set} tiers set, "
            f"{result.untiered_skipped} untiered skipped, "
            f"{result.not_found_skipped} not found, "
            f"{result.errors} errors"
        )
        if result.error_details:
            typer.echo("\nErrors:")
            for identifier, message in result.error_details:
                typer.echo(f"  {identifier}: {message}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
