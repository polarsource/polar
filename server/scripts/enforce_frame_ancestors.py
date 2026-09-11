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

The first two are walked one origin at a time: add it or leave it, then switch
the organization on or not. The third is offered as a single batch.

An organization in `ready` is a bet: we know it frames from hosts it has
listed, not that it never frames from anywhere else. The `breaking` group is
how that bet is settled, which is why this is worth running regularly.

Usage:
    cd server

    # A Logfire read token
    export LOGFIRE_READ_TOKEN=pylf_...

    # Rehearsal: the questions run, nothing is written
    uv run python -m scripts.enforce_frame_ancestors

    # For real
    uv run python -m scripts.enforce_frame_ancestors --execute

    # A shortlist
    uv run python -m scripts.enforce_frame_ancestors --slug acme --execute
"""

from dataclasses import dataclass, field
from datetime import timedelta
from uuid import UUID

import structlog
import typer
from rich.console import Console
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Organization
from polar.organization.embed_hosts import InvalidEmbedHost
from polar.organization.schemas import validate_embed_hosts
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
    def blocked(self) -> bool:
        """Plain HTTP on a public host: refused, and no entry can change that."""
        return bool(self.candidate.blocked)

    @property
    def outstanding(self) -> bool:
        return bool(self.decisions) or self.blocked

    @property
    def breaking(self) -> bool:
        return self.enforced and self.outstanding

    @property
    def ready(self) -> bool:
        return not self.enforced and not self.outstanding


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


@dataclass
class Groups:
    breaking: list[Review]
    deciding: list[Review]
    ready: list[Review]
    done: list[Review]

    @property
    def walked(self) -> list[Review]:
        """The organizations worth a question, the live outage first."""
        return self.breaking + self.deciding


def _partition(reviews: list[Review]) -> Groups:
    return Groups(
        breaking=[r for r in reviews if r.breaking],
        deciding=[r for r in reviews if not r.enforced and r.outstanding],
        ready=[r for r in reviews if r.ready],
        done=[r for r in reviews if r.enforced and not r.outstanding],
    )


def _describe(review: Review, host: str, stat: HostStat) -> str:
    signals = f"  [{', '.join(stat.signals)}]" if stat.signals else ""
    reason = f"  ({review.reasons[host]})" if host in review.reasons else ""
    return f"{host}  {stat.checkouts} loads{signals}{reason}"


def _summary(groups: Groups) -> None:
    if groups.breaking:
        console.print(
            f"[bold red]{len(groups.breaking)} switched on and being refused "
            "right now:[/bold red] "
            + ", ".join(review.slug for review in groups.breaking)
        )
    console.print(
        f"{len(groups.walked) + len(groups.ready) + len(groups.done)} observed, "
        f"{len(groups.breaking)} breaking, {len(groups.deciding)} to decide, "
        f"{len(groups.ready)} ready, {len(groups.done)} done\n"
    )


@dataclass
class Decision:
    organization_id: UUID
    slug: str
    current_hosts: list[str]
    hosts: list[str] = field(default_factory=list)
    enable: bool = False


def _decide(groups: Groups) -> list[Decision]:
    """Walk the organizations that need an answer, one origin at a time."""
    decisions: list[Decision] = []

    for review in groups.walked:
        candidate = review.candidate
        console.rule(
            f"[bold]{review.slug}[/bold]  "
            + ("[red]enforced, breaking[/red]" if review.enforced else "not enforced")
        )
        console.print(f"  listed: {candidate.current_hosts or 'nothing'}")
        for origin, _ in candidate.blocked:
            console.print(
                f"  [yellow]{origin}: plain HTTP on a public host, no entry can "
                "admit it[/yellow]"
            )

        chosen: list[str] = []
        for host, stat in review.decisions:
            if typer.confirm(f"  add {_describe(review, host, stat)}?", default=False):
                chosen.append(host)

        enable = review.enforced
        if not review.enforced:
            remaining = [host for host, _ in review.decisions if host not in chosen]
            if remaining:
                console.print(
                    f"  [yellow]{len(remaining)} origin(s) would still be "
                    f"refused: {', '.join(remaining)}[/yellow]"
                )
            enable = typer.confirm("  enable enforcement?", default=False)

        if chosen or (enable and not review.enforced):
            decisions.append(
                Decision(
                    organization_id=candidate.organization_id,
                    slug=review.slug,
                    current_hosts=candidate.current_hosts,
                    hosts=chosen,
                    enable=enable,
                )
            )

    if groups.ready and typer.confirm(
        f"\nEnable enforcement for the {len(groups.ready)} covered organizations?",
        default=False,
    ):
        decisions += [
            Decision(
                organization_id=review.candidate.organization_id,
                slug=review.slug,
                current_hosts=review.candidate.current_hosts,
                enable=True,
            )
            for review in groups.ready
        ]

    return decisions


async def _apply(session: AsyncSession, decisions: list[Decision]) -> None:
    """Re-read under lock: a merchant may have edited their own list while the
    prompts were open. `populate_existing` says the locked row wins over
    anything already loaded, so this holds however the sessions above are
    arranged.
    """
    organizations = {
        organization.id: organization
        for organization in (
            await session.execute(
                select(Organization)
                .where(
                    Organization.id.in_([d.organization_id for d in decisions]),
                    Organization.deleted_at.is_(None),
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    }

    written = 0
    for decision in decisions:
        organization = organizations.get(decision.organization_id)
        if organization is None:
            console.print(f"[yellow]{decision.slug}: gone, left alone.")
            continue
        if organization.embed_hosts != decision.current_hosts:
            console.print(
                f"[yellow]{decision.slug}: list changed since we read it, left alone."
            )
            continue

        if decision.hosts:
            try:
                organization.embed_hosts = validate_embed_hosts(
                    [*organization.embed_hosts, *decision.hosts]
                )
            except (InvalidEmbedHost, ValueError) as e:
                console.print(f"[red]{decision.slug}: {e}")
                continue
        if decision.enable:
            organization.feature_settings = {
                **organization.feature_settings,
                "frame_ancestors_enforced": True,
            }

        session.add(organization)
        written += 1
        log.info(
            "frame_ancestors.set",
            organization_id=str(organization.id),
            slug=decision.slug,
            embed_hosts=organization.embed_hosts,
            enforced=organization.is_frame_ancestors_enforced,
        )

    await session.commit()
    console.print(f"\n[green]Wrote {written} organization(s).")


@cli.command()
@typer_async
async def enforce_frame_ancestors(
    read_token: str = typer.Option(
        ...,
        envvar="LOGFIRE_READ_TOKEN",
        help="Logfire read token. A write token cannot query.",
    ),
    execute: bool = typer.Option(
        False, help="Write the answers (default: rehearse, write nothing)"
    ),
    slug: list[str] = typer.Option([], help="Only these organizations."),
    window: int = typer.Option(
        RETENTION.days, help="Days of observations to read from Logfire."
    ),
) -> None:
    observations = await load(read_token, timedelta(days=window))
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        # Read, then let go: answering takes as long as it takes, and an open
        # transaction that whole time holds a snapshot on the primary.
        async with sessionmaker() as session:
            reviews = await _load_reviews(session, observations, slug)

        groups = _partition(reviews)
        _summary(groups)

        decisions = _decide(groups)
        if not decisions:
            console.print("[green]Nothing to write.")
            return

        hosts = sum(len(decision.hosts) for decision in decisions)
        enabled = sum(1 for decision in decisions if decision.enable)
        if not execute:
            console.print(
                f"[yellow]Rehearsal — --execute would add {hosts} host(s) "
                f"and switch on {enabled} organization(s)."
            )
            return

        async with sessionmaker() as session:
            await _apply(session, decisions)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
