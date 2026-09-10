"""Switch organizations onto `frame-ancestors`, one at a time.

The checkout page tells the browser which hosts may frame it, but only for an
organization whose `frame_ancestors_enforced` flag is on. Everyone else keeps
`frame-ancestors *`, which is what the page serves today. This walks the
organizations we have actually seen framed, fills what their list is missing,
and switches them on.

The observations come from Logfire — the `Referer` of every framed checkout
load — because `Checkout.embed_origin` only records what a merchant declares,
and misses anyone framing without declaring. See
`scripts/frame_ancestors_observations`.

Nothing is remembered between runs. Every origin is re-matched against the
list as it stands, so a host added since the log line was written simply stops
showing up, and a host you declined comes back.

Four groups come out of it:

- breaking, organizations already switched on that are being refused — a live
  outage, and the reason to run this regularly;
- deciding, organizations with an origin their list would refuse;
- ready, organizations whose observed origins are all covered, waiting to be
  switched on;
- done, switched on with nothing outstanding.

An organization in `ready` is a bet: we know it frames from hosts it has
listed, not that it never frames from anywhere else. The `breaking` group is
how that bet is settled.

Usage:
    cd server

    # Needs a Logfire read token, see POLAR_LOGFIRE_READ_TOKEN in .env.template
    uv run python -m scripts.enforce_frame_ancestors

    # A shortlist
    uv run python -m scripts.enforce_frame_ancestors --slug acme --slug acme-labs
"""

from dataclasses import dataclass, field
from datetime import timedelta
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.postgres import create_async_engine
from scripts.frame_ancestors_observations import RETENTION, Observation, load
from scripts.helper import configure_script_console_logging, typer_async
from scripts.set_organization_embed_hosts import Candidate, HostStat, _classify

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

# Everything the log can still show us is worth a decision, so nothing is held
# back for being quiet or recent.
MIN_CHECKOUTS = 1
MIN_DAYS = 0
MAX_HOSTS = 50


@dataclass
class Review:
    candidate: Candidate
    enforced: bool
    reasons: dict[str, str] = field(default_factory=dict)

    @property
    def slug(self) -> str:
        return self.candidate.slug

    @property
    def decisions(self) -> list[tuple[str, HostStat]]:
        """Origins the list would refuse, the ones it vouches for first."""
        return self.candidate.ready + self.candidate.uncovered_after

    @property
    def breaking(self) -> bool:
        return self.enforced and bool(self.decisions)

    @property
    def ready(self) -> bool:
        return not self.enforced and not self.decisions


async def _load_reviews(
    session: AsyncSession,
    observations: dict[UUID, list[Observation]],
    slugs: list[str],
) -> list[Review]:
    statement = select(Organization).where(
        Organization.id.in_(observations),
        Organization.deleted_at.is_(None),
    )
    if slugs:
        statement = statement.where(Organization.slug.in_(slugs))

    reviews: list[Review] = []
    for organization in (await session.execute(statement)).scalars():
        candidate = Candidate(
            organization_id=organization.id,
            slug=organization.slug,
            name=organization.name,
            website=organization.website,
            current_hosts=list(organization.embed_hosts),
        )
        observed = observations[organization.id]
        candidate.embeds = sum(loads for _, loads, _ in observed)
        _classify(
            candidate,
            observed,
            min_checkouts=MIN_CHECKOUTS,
            min_days=MIN_DAYS,
            max_hosts=MAX_HOSTS,
            include_local=True,
            require_signal=False,
            stale_days=RETENTION.days,
        )
        reviews.append(
            Review(
                candidate=candidate,
                enforced=organization.is_frame_ancestors_enforced,
                reasons=dict(candidate.skipped),
            )
        )

    reviews.sort(key=lambda review: -review.candidate.embeds)
    return reviews


def _decisions_table(title: str, reviews: list[Review], *, style: str) -> Table:
    table = Table(title=title, title_justify="left", title_style=style)
    table.add_column("Organization")
    table.add_column("Framed", justify="right")
    table.add_column("Listed", justify="right")
    table.add_column("Origins the list refuses")
    for review in reviews:
        table.add_row(
            review.slug,
            str(review.candidate.embeds),
            str(len(review.candidate.current_hosts)),
            "\n".join(
                f"{host}  {stat.checkouts} loads"
                + (f"  [{', '.join(stat.signals)}]" if stat.signals else "")
                + (f"  ({review.reasons[host]})" if host in review.reasons else "")
                for host, stat in review.decisions
            ),
        )
    return table


def _render(reviews: list[Review]) -> None:
    breaking = [review for review in reviews if review.breaking]
    deciding = [
        review for review in reviews if not review.enforced and review.decisions
    ]
    ready = [review for review in reviews if review.ready]
    done = [review for review in reviews if review.enforced and not review.decisions]

    if breaking:
        console.print(
            _decisions_table("Breaking now", breaking, style="bold red"),
        )

    if deciding:
        console.print(_decisions_table("Waiting on a decision", deciding, style=""))

    blocked = [review for review in reviews if review.candidate.blocked]
    if blocked:
        table = Table(
            title="Cannot be listed (plain HTTP on a public host)",
            title_justify="left",
        )
        table.add_column("Organization")
        table.add_column("Origin")
        for review in blocked:
            table.add_row(
                review.slug,
                "\n".join(origin for origin, _ in review.candidate.blocked),
            )
        console.print(table)

    if ready:
        console.print(
            f"\n[bold]{len(ready)} organizations ready to switch on[/bold] "
            "— every origin we have seen is covered"
        )
        console.print(", ".join(review.slug for review in ready))

    console.print(
        f"\n{len(reviews)} observed, {len(breaking)} breaking, "
        f"{len(deciding)} to decide, {len(ready)} ready, {len(done)} done"
    )


@cli.command()
@typer_async
async def enforce_frame_ancestors(
    slug: list[str] = typer.Option([], help="Only these organizations."),
    window: int = typer.Option(
        RETENTION.days, help="Days of observations to read from Logfire."
    ),
) -> None:
    observations = await load(timedelta(days=window))
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            reviews = await _load_reviews(session, observations, slug)
    finally:
        await engine.dispose()

    _render(reviews)


if __name__ == "__main__":
    cli()
