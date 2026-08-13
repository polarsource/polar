"""
Set embed hosts on behalf of merchants who embed but never listed a host.

Enforcement refuses any embedded checkout whose origin is not on the
organization's list, so a merchant who embeds and lists nothing loses every
embedded checkout. This lists those organizations, ranked by how much they
embed, and can fill the list from the origins we have actually seen.

The origin is declared by whoever opens the checkout — the page tells us its own
address and we take it at that. That is the very hole enforcement closes, so a
host seen once is not evidence of anything: anyone can name an origin. The
thresholds are what make a host trustworthy enough to write on a merchant's
behalf, and lowering them re-opens the hole for the organizations this touches.
Read the dry run before executing.

Three groups come out of it:

- ready, hosts we would set;
- blocked, merchants embedding over plain HTTP on a public host, which no entry
  can ever match — they need a redirect to HTTPS, not a list;
- skipped, hosts held back by a threshold, or per-tenant preview hosts such as
  `<hash>.vercel.app`, which change on every deploy and would be stale by the
  time they are written.

Reads run on the replica, writes on the primary. The sweep scans a window of
`checkouts` with no index on `embed_origin`, so it takes minutes and carries its
own timeout rather than the 30 seconds the shared engine allows. Naming
organizations with `--slug` reaches them through `organization_id` instead, which
returns at once — the way to work a shortlist.

Usage:
    cd server

    # A shortlist, indexed and immediate:
    uv run python -m scripts.set_organization_embed_hosts --slug acme --slug acme-labs

    # Everyone, scanning the window:
    uv run python -m scripts.set_organization_embed_hosts

    # Stricter, and show every host held back:
    uv run python -m scripts.set_organization_embed_hosts --min-checkouts 50 --verbose

    # Set the hosts:
    uv run python -m scripts.set_organization_embed_hosts --min-checkouts 50 --execute
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from tld import is_tld

from polar.config import settings
from polar.kit.db import postgres as kit_postgres
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Checkout, Organization
from polar.organization.embed_hosts import (
    EMBED_ORIGIN_WINDOW,
    InvalidEmbedHost,
    host_for_origin,
    is_local_host,
    parse_origin,
    uncovered_hosts,
)
from polar.organization.schemas import validate_embed_hosts
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

_TOKEN = re.compile(r"[a-z0-9]+")


@dataclass
class Candidate:
    organization_id: UUID
    slug: str
    name: str
    current_hosts: list[str]
    embeds: int = 0
    ready: list[tuple[str, int, datetime]] = field(default_factory=list)
    blocked: list[tuple[str, int, datetime]] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)

    @property
    def affinity(self) -> bool:
        """Whether a host we would set shares a word with the organization.

        `acme.com` against `acme-labs` is the merchant's own domain; a host with
        nothing in common is worth a look before writing it.
        """
        known = set(_TOKEN.findall(f"{self.slug} {self.name}".lower()))
        return any(
            known & set(_TOKEN.findall(host.lower())) for host, _, _ in self.ready
        )


def _read_engine(command_timeout: float) -> AsyncEngine:
    """The replica, and long enough to finish.

    Scanning a window of `checkouts` runs well past the 30 seconds the shared
    engine allows, and `embed_origin` has no index, so this reads where a long
    scan costs nothing.
    """
    return kit_postgres.create_async_engine(
        dsn=str(settings.get_postgres_read_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.script",
        pool_logging_name="script_read",
        pool_size=1,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=command_timeout,
        connect_timeout=settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        ssl="require" if settings.POSTGRES_SSL else None,
    )


def _is_preview_host(host: str) -> bool:
    """Whether the host is one tenant of a platform, `<hash>.vercel.app`.

    The hash changes on every deploy, so the entry is stale as soon as it is
    written. `*.vercel.app` would cover it and admit every other tenant too, so
    the merchant has to weigh that themselves.
    """
    _, _, parent = host.partition(".")
    return bool(parent) and is_tld(parent)


async def _load_candidates(
    session: AsyncSession, since: datetime, slugs: list[str]
) -> tuple[dict[UUID, Candidate], dict[UUID, list[tuple[str, int, datetime]]]]:
    statement = (
        select(
            Organization.id,
            Organization.slug,
            Organization.name,
            Organization.embed_hosts,
            Checkout.embed_origin,
            func.count().label("checkouts"),
            func.max(Checkout.created_at).label("last_seen_at"),
        )
        .join(Checkout, Checkout.organization_id == Organization.id)
        .where(
            Organization.deleted_at.is_(None),
            Organization.can_accept_payments,
            Checkout.deleted_at.is_(None),
            Checkout.embed_origin.is_not(None),
            Checkout.created_at >= since,
        )
        .group_by(
            Organization.id,
            Organization.slug,
            Organization.name,
            Organization.embed_hosts,
            Checkout.embed_origin,
        )
    )
    # Named organizations reach `checkouts` through its `organization_id` index,
    # rather than scanning the window.
    if slugs:
        statement = statement.where(Organization.slug.in_(slugs))

    candidates: dict[UUID, Candidate] = {}
    observed: dict[UUID, list[tuple[str, int, datetime]]] = defaultdict(list)
    for row in (await session.execute(statement)).all():
        candidate = candidates.setdefault(
            row.id,
            Candidate(
                organization_id=row.id,
                slug=row.slug,
                name=row.name,
                current_hosts=list(row.embed_hosts),
            ),
        )
        candidate.embeds += row.checkouts
        observed[row.id].append((row.embed_origin, row.checkouts, row.last_seen_at))

    return candidates, observed


def _classify(
    candidate: Candidate,
    observed: list[tuple[str, int, datetime]],
    *,
    min_checkouts: int,
    max_hosts: int,
    include_local: bool,
) -> None:
    # `uncovered_hosts` drops what no entry could admit, so plain HTTP on a
    # public host is found here rather than read off its result.
    for value, checkouts, last_seen_at in observed:
        origin = parse_origin(value)
        if origin is not None and host_for_origin(origin) is None:
            candidate.blocked.append((str(origin), checkouts, last_seen_at))

    for host in uncovered_hosts(observed, candidate.current_hosts):
        if host.checkouts < min_checkouts:
            candidate.skipped.append(
                (host.host, f"{host.checkouts} checkouts, under {min_checkouts}")
            )
        elif _is_preview_host(host.host):
            candidate.skipped.append((host.host, "per-tenant preview host"))
        elif not include_local and is_local_host(host.host.partition(":")[0]):
            candidate.skipped.append((host.host, "local host"))
        else:
            candidate.ready.append((host.host, host.checkouts, host.last_seen_at))

    candidate.ready.sort(key=lambda entry: entry[1], reverse=True)
    if len(candidate.ready) > max_hosts:
        for extra, extra_checkouts, _ in candidate.ready[max_hosts:]:
            candidate.skipped.append(
                (extra, f"over --max-hosts ({extra_checkouts} checkouts)")
            )
        del candidate.ready[max_hosts:]


def _render(candidates: list[Candidate], *, verbose: bool) -> None:
    ready = [c for c in candidates if c.ready]
    blocked = [c for c in candidates if c.blocked and not c.ready]

    if ready:
        table = Table(title="Ready to set", title_justify="left")
        table.add_column("Organization")
        table.add_column("Embeds", justify="right")
        table.add_column("Hosts to add")
        table.add_column("Already listed", justify="right")
        table.add_column("Name match")
        for candidate in ready:
            hosts = "\n".join(
                f"{host}  ({checkouts} checkouts, last {last_seen_at:%Y-%m-%d})"
                for host, checkouts, last_seen_at in candidate.ready
            )
            table.add_row(
                candidate.slug,
                str(candidate.embeds),
                hosts,
                str(len(candidate.current_hosts)),
                "yes" if candidate.affinity else "[yellow]no",
            )
        console.print(table)

    if blocked:
        table = Table(
            title="Cannot be fixed here — embedding over HTTP on a public host",
            title_justify="left",
        )
        table.add_column("Organization")
        table.add_column("Origins")
        for candidate in blocked:
            table.add_row(
                candidate.slug,
                "\n".join(
                    f"{origin}  ({checkouts} checkouts, last {last_seen_at:%Y-%m-%d})"
                    for origin, checkouts, last_seen_at in candidate.blocked
                ),
            )
        console.print(table)
        console.print(
            "[yellow]These need a redirect to HTTPS on their own site. "
            "No entry can ever match an HTTP origin on a public host.\n"
        )

    if verbose:
        skipped = [c for c in candidates if c.skipped]
        if skipped:
            table = Table(title="Held back", title_justify="left")
            table.add_column("Organization")
            table.add_column("Host")
            table.add_column("Reason")
            for candidate in skipped:
                for host, reason in candidate.skipped:
                    table.add_row(candidate.slug, host, reason)
            console.print(table)


@cli.command()
@typer_async
async def set_embed_hosts(
    execute: bool = typer.Option(
        False, help="Set the hosts (default: dry-run, list only)"
    ),
    min_checkouts: int = typer.Option(
        20, help="Least embedded checkouts a host needs before we would set it"
    ),
    max_hosts: int = typer.Option(
        5, help="Most hosts to set for one organization, busiest first"
    ),
    window_days: int = typer.Option(
        EMBED_ORIGIN_WINDOW.days, help="How far back to look for embed origins"
    ),
    include_local: bool = typer.Option(
        False, help="Also set local hosts such as localhost:3000"
    ),
    limit: int = typer.Option(0, help="Stop after this many organizations (0: all)"),
    slug: list[str] = typer.Option(
        [], help="Only these organizations, repeatable. Indexed, so it is fast."
    ),
    command_timeout: float = typer.Option(
        600.0, help="Seconds the scan may take before the driver cancels it"
    ),
    verbose: bool = typer.Option(False, help="Also list the hosts held back"),
) -> None:
    since = datetime.now(UTC) - timedelta(days=window_days)
    read_engine = _read_engine(command_timeout)

    try:
        async with create_async_sessionmaker(read_engine)() as session:
            if not slug:
                console.print(
                    f"[dim]Scanning {window_days} days of checkouts on the read "
                    "replica. Minutes, not seconds — pass --slug to narrow it."
                )
            candidates, observed = await _load_candidates(session, since, slug)
    finally:
        await read_engine.dispose()

    for candidate in candidates.values():
        _classify(
            candidate,
            observed[candidate.organization_id],
            min_checkouts=min_checkouts,
            max_hosts=max_hosts,
            include_local=include_local,
        )

    ranked = sorted(candidates.values(), key=lambda c: c.embeds, reverse=True)
    if limit:
        ranked = ranked[:limit]

    _render(ranked, verbose=verbose)

    actionable = [c for c in ranked if c.ready]
    if not actionable:
        console.print("[green]Nothing to set.")
        return

    hosts_total = sum(len(c.ready) for c in actionable)
    if not execute:
        console.print(
            f"[yellow]Dry-run — use --execute to set {hosts_total} host(s) "
            f"across {len(actionable)} organization(s)."
        )
        return

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            console.rule("[bold]Setting embed hosts")
            organizations = {
                organization.id: organization
                for organization in (
                    await session.execute(
                        select(Organization).where(
                            Organization.id.in_([c.organization_id for c in actionable])
                        )
                    )
                )
                .scalars()
                .all()
            }

            updated = 0
            for candidate in actionable:
                organization = organizations[candidate.organization_id]
                # The replica lags, and the scan takes minutes. A merchant who
                # edited their own list in between has answered for themselves.
                if organization.embed_hosts != candidate.current_hosts:
                    console.print(
                        f"[yellow]{candidate.slug}: list changed since the scan, "
                        "left alone."
                    )
                    continue
                hosts = [*organization.embed_hosts, *(h for h, _, _ in candidate.ready)]
                try:
                    organization.embed_hosts = validate_embed_hosts(hosts)
                except (InvalidEmbedHost, ValueError) as e:
                    console.print(f"[red]{candidate.slug}: {e}")
                    continue
                session.add(organization)
                updated += 1
                log.info(
                    "embed_hosts.set",
                    organization_id=str(organization.id),
                    slug=candidate.slug,
                    embed_hosts=organization.embed_hosts,
                )

            await session.commit()
            console.print(f"\n[green]Set embed hosts for {updated} organization(s).")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
