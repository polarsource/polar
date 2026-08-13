"""
Set embed hosts on behalf of merchants who embed but never listed a host.

Enforcement refuses any embedded checkout whose origin is not on the
organization's list, so a merchant who embeds and lists nothing loses every
embedded checkout. This lists those organizations, ranked by how much they
embed, and can fill the list from the origins we have actually seen.

The origin is declared by whoever opens the checkout — the page tells us its own
address and we take it at that. That is the very hole enforcement closes, so a
count alone proves nothing: anyone can name an origin, repeatedly. Every host is
therefore scored against things the merchant told us out of band, and the
signals are printed so the decision stays yours:

- `site`, the host sits under the domain of the website on their account;
- `listed`, it sits under a domain they already put on their own list;
- `name`, it resembles their slug or organization name;
- `rdap`, its registrar and nameservers match a domain they own (`--rdap`).

Note what is deliberately not a signal: completed payments. In the attack this
closes, the payment succeeds — that is the point, the token stolen belongs to
the customer who just paid. Revenue from an origin says nothing about who owns
it.

Three groups come out of it:

- ready, hosts we would set;
- blocked, merchants embedding over plain HTTP on a public host, which no entry
  can ever match — they need a redirect to HTTPS, not a list;
- skipped, hosts held back by a threshold, or per-tenant preview hosts such as
  `<hash>.vercel.app`, which change on every deploy and would be stale by the
  time they are written.

Writing the busiest host and leaving a quieter live one out leaves a merchant
half covered and looking done, so anything still uncovered afterwards is called
out separately.

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

    # Only hosts the merchant vouched for out of band, with registry checks:
    uv run python -m scripts.set_organization_embed_hosts --require-signal --rdap

    # Set the hosts:
    uv run python -m scripts.set_organization_embed_hosts --min-checkouts 50 --execute
"""

import json as jsonlib
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx
import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from tld import get_fld, is_tld

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

RDAP_URL = "https://rdap.org/domain/{domain}"
RDAP_TIMEOUT = 8.0
# Below this, a shared word means nothing: every other domain contains "ai".
MIN_SHARED_WORD = 4


@dataclass
class HostStat:
    checkouts: int
    days: int
    last_seen_at: datetime
    signals: list[str] = field(default_factory=list)


@dataclass
class Candidate:
    organization_id: UUID
    slug: str
    name: str
    website: str | None
    current_hosts: list[str]
    embeds: int = 0
    host_stats: dict[str, HostStat] = field(default_factory=dict)
    ready: list[tuple[str, HostStat]] = field(default_factory=list)
    blocked: list[tuple[str, HostStat]] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)
    uncovered_after: list[tuple[str, HostStat]] = field(default_factory=list)


def _normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _registrable(host: str) -> str | None:
    """The part of a host its owner actually registered.

    A platform suffix counts as registered by the tenant, so `foo.vercel.app`
    reduces to itself rather than to `vercel.app`.
    """
    return get_fld(f"https://{host}", fail_silently=True)


def _read_engine(command_timeout: float) -> AsyncEngine:
    """The replica when there is one, and long enough to finish.

    Scanning a window of `checkouts` runs well past the 30 seconds the shared
    engine allows, and `embed_origin` has no index, so this reads where a long
    scan costs nothing.
    """
    dsn = (
        settings.get_postgres_read_dsn("asyncpg")
        if settings.is_read_replica_configured()
        else settings.get_postgres_dsn("asyncpg")
    )
    return kit_postgres.create_async_engine(
        dsn=str(dsn),
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

    What is left after the first label has to be a suffix a company operates for
    its tenants: `vercel.app`, `pages.dev`. A registry suffix does not count,
    however many labels it carries — `acme.co.uk` is a merchant's own domain,
    not one tenant of `co.uk`.
    """
    _, _, parent = host.partition(".")
    return is_tld(parent) and not is_tld(parent, search_private=False)


def _owned_domains(candidate: Candidate) -> dict[str, str]:
    """Domains the merchant named themselves, and where each came from.

    Their website comes from their account and their list from their own
    settings page. Neither can be set by whoever opens a checkout, which is what
    makes them worth trusting.
    """
    domains: dict[str, str] = {}
    for entry in candidate.current_hosts:
        registrable = _registrable(entry.removeprefix("*.").partition(":")[0])
        if registrable:
            domains[registrable] = "listed"
    if candidate.website:
        website = get_fld(candidate.website, fix_protocol=True, fail_silently=True)
        if website:
            domains[website] = "site"
    return domains


def _name_signal(candidate: Candidate, host: str) -> bool:
    """Whether the host reads as the merchant's own name.

    Compared with separators removed, so `stencil-ai` meets `stencilai.app`.
    """
    registrable = _registrable(host)
    if registrable is None:
        return False

    label = _normalized(registrable.partition(".")[0])
    if len(label) < MIN_SHARED_WORD:
        return False

    for known in (_normalized(candidate.slug), _normalized(candidate.name)):
        if len(known) < MIN_SHARED_WORD:
            continue
        if label in known or known in label:
            return True
    return False


async def _rdap(domain: str, client: httpx.AsyncClient) -> dict[str, Any] | None:
    """Registrar and nameservers, or nothing.

    Registrant details are redacted on most registries, so what is left to
    compare is where a domain was bought and who serves its DNS.
    """
    try:
        response = await client.get(
            RDAP_URL.format(domain=domain), follow_redirects=True
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None

    registrar = next(
        (
            entity["vcardArray"][1][1][3]
            for entity in payload.get("entities", [])
            if "registrar" in entity.get("roles", []) and entity.get("vcardArray")
        ),
        None,
    )
    nameservers = {
        _registrable(server["ldhName"].lower())
        for server in payload.get("nameservers", [])
        if server.get("ldhName")
    }
    return {"registrar": registrar, "nameservers": nameservers - {None}}


async def _rdap_kinship(
    host: str, owned: set[str], client: httpx.AsyncClient, cache: dict[str, Any]
) -> bool:
    """Whether the host's domain was bought and served like one they own."""
    registrable = _registrable(host)
    if registrable is None or not owned:
        return False

    for domain in {registrable, *owned}:
        if domain not in cache:
            cache[domain] = await _rdap(domain, client)

    subject = cache[registrable]
    if subject is None:
        return False

    for domain in owned:
        known = cache[domain]
        if known is None:
            continue
        if (
            subject["registrar"] is not None
            and subject["registrar"] == known["registrar"]
            and subject["nameservers"]
            and subject["nameservers"] == known["nameservers"]
        ):
            return True
    return False


async def _load_candidates(
    session: AsyncSession, since: datetime, slugs: list[str]
) -> tuple[dict[UUID, Candidate], dict[UUID, list[tuple[str, int, datetime]]]]:
    statement = (
        select(
            Organization.id,
            Organization.slug,
            Organization.name,
            Organization.website,
            Organization.embed_hosts,
            Checkout.embed_origin,
            func.count().label("checkouts"),
            func.count(
                func.distinct(func.date_trunc("day", Checkout.created_at))
            ).label("days"),
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
            Organization.website,
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
    stats: dict[UUID, dict[str, HostStat]] = defaultdict(dict)
    for row in (await session.execute(statement)).all():
        candidate = candidates.setdefault(
            row.id,
            Candidate(
                organization_id=row.id,
                slug=row.slug,
                name=row.name,
                website=row.website,
                current_hosts=list(row.embed_hosts),
            ),
        )
        candidate.embeds += row.checkouts
        observed[row.id].append((row.embed_origin, row.checkouts, row.last_seen_at))

        origin = parse_origin(row.embed_origin)
        host = host_for_origin(origin) if origin is not None else None
        if host is None:
            continue
        seen = stats[row.id].get(host)
        stats[row.id][host] = HostStat(
            checkouts=row.checkouts + (seen.checkouts if seen else 0),
            days=max(row.days, seen.days if seen else 0),
            last_seen_at=max(row.last_seen_at, seen.last_seen_at)
            if seen
            else row.last_seen_at,
        )

    for organization_id, candidate in candidates.items():
        candidate.host_stats = stats[organization_id]

    return candidates, observed


def _classify(
    candidate: Candidate,
    observed: list[tuple[str, int, datetime]],
    *,
    min_checkouts: int,
    min_days: int,
    max_hosts: int,
    include_local: bool,
    require_signal: bool,
    stale_days: int,
) -> None:
    stats = candidate.host_stats
    owned = _owned_domains(candidate)
    now = datetime.now(UTC)

    # `uncovered_hosts` drops what no entry could admit, so plain HTTP on a
    # public host is found here rather than read off its result.
    for value, checkouts, last_seen_at in observed:
        origin = parse_origin(value)
        if origin is None or host_for_origin(origin) is not None:
            continue
        if checkouts < min_checkouts:
            continue
        candidate.blocked.append(
            (
                str(origin),
                HostStat(checkouts=checkouts, days=0, last_seen_at=last_seen_at),
            )
        )

    for host in uncovered_hosts(observed, candidate.current_hosts):
        stat = stats.get(
            host.host,
            HostStat(checkouts=host.checkouts, days=0, last_seen_at=host.last_seen_at),
        )
        registrable = _registrable(host.host)
        if registrable is not None and registrable in owned:
            stat.signals.append(owned[registrable])
        if _name_signal(candidate, host.host):
            stat.signals.append("name")

        if host.checkouts < min_checkouts:
            reason = f"{host.checkouts} checkouts, under {min_checkouts}"
        elif stat.days < min_days:
            reason = f"seen on {stat.days} day(s), under {min_days}"
        elif _is_preview_host(host.host):
            reason = "per-tenant preview host"
        elif not include_local and is_local_host(host.host.partition(":")[0]):
            reason = "local host"
        elif require_signal and not stat.signals:
            reason = "nothing vouches for it"
        else:
            candidate.ready.append((host.host, stat))
            continue

        candidate.skipped.append((host.host, reason))
        if (now - stat.last_seen_at).days <= stale_days:
            candidate.uncovered_after.append((host.host, stat))

    candidate.ready.sort(key=lambda entry: entry[1].checkouts, reverse=True)
    if len(candidate.ready) > max_hosts:
        for extra, stat in candidate.ready[max_hosts:]:
            candidate.skipped.append(
                (extra, f"over --max-hosts ({stat.checkouts} checkouts)")
            )
            candidate.uncovered_after.append((extra, stat))
        del candidate.ready[max_hosts:]

    candidate.blocked.sort(key=lambda entry: entry[1].last_seen_at, reverse=True)
    candidate.uncovered_after.sort(key=lambda entry: entry[1].checkouts, reverse=True)


async def _apply_rdap(candidates: list[Candidate]) -> None:
    cache: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=RDAP_TIMEOUT) as client:
        for candidate in candidates:
            owned = set(_owned_domains(candidate))
            for host, stat in candidate.ready:
                if stat.signals:
                    continue
                if await _rdap_kinship(host, owned, client, cache):
                    stat.signals.append("rdap")


def _describe(stat: HostStat) -> str:
    days = f", {stat.days} day(s)" if stat.days else ""
    signals = f" [{'+'.join(stat.signals)}]" if stat.signals else ""
    return (
        f"({stat.checkouts} checkouts{days}, "
        f"last {stat.last_seen_at:%Y-%m-%d}){signals}"
    )


def _render(candidates: list[Candidate], *, verbose: bool) -> None:
    ready = [c for c in candidates if c.ready]
    # Also when there are hosts to set: fixing one origin and leaving an HTTP one
    # refused would otherwise read as a merchant put right.
    blocked = [c for c in candidates if c.blocked]
    partial = [c for c in candidates if c.ready and c.uncovered_after]

    if ready:
        table = Table(title="Ready to set", title_justify="left")
        table.add_column("Organization")
        table.add_column("Embeds", justify="right")
        table.add_column("Hosts to add")
        table.add_column("Listed", justify="right")
        for candidate in ready:
            table.add_row(
                candidate.slug,
                str(candidate.embeds),
                "\n".join(
                    f"{host}  {_describe(stat)}" for host, stat in candidate.ready
                ),
                str(len(candidate.current_hosts)),
            )
        console.print(table)
        console.print(
            "[dim]Signals: site = their website's domain, listed = a domain "
            "already on their list, name = resembles the organization, "
            "rdap = same registrar and nameservers as a domain they own.\n"
        )

    if partial:
        table = Table(
            title="Still uncovered after writing — these merchants stay broken",
            title_justify="left",
        )
        table.add_column("Organization")
        table.add_column("Host")
        for candidate in partial:
            table.add_row(
                candidate.slug,
                "\n".join(
                    f"{host}  {_describe(stat)}"
                    for host, stat in candidate.uncovered_after
                ),
            )
        console.print(table)

    if blocked:
        table = Table(
            title="Cannot be fixed here — embedding over HTTP on a public host",
            title_justify="left",
        )
        table.add_column("Organization")
        table.add_column("Origins, most recent first")
        for candidate in blocked:
            table.add_row(
                candidate.slug,
                "\n".join(
                    f"{origin}  {_describe(stat)}" for origin, stat in candidate.blocked
                ),
            )
        console.print(table)
        console.print(
            "[yellow]These need a redirect to HTTPS on their own site. No entry "
            "can ever match an HTTP origin on a public host. Check the dates "
            "before writing to them — a merchant who migrated months ago still "
            "shows up on the strength of old checkouts.\n"
        )

    if verbose:
        held = [c for c in candidates if c.ready and c.skipped]
        if held:
            table = Table(
                title="Held back, for organizations we would write to",
                title_justify="left",
            )
            table.add_column("Organization")
            table.add_column("Host")
            table.add_column("Reason")
            for candidate in held:
                for host, reason in candidate.skipped:
                    table.add_row(candidate.slug, host, reason)
            console.print(table)

    for label, group in (("ready", ready), ("blocked", blocked)):
        if group:
            console.print(f"[dim]{label}:[/dim] {','.join(c.slug for c in group)}\n")


def _as_json(candidates: list[Candidate]) -> str:
    return jsonlib.dumps(
        [
            {
                "slug": candidate.slug,
                "organization_id": str(candidate.organization_id),
                "embeds": candidate.embeds,
                "listed": candidate.current_hosts,
                "ready": [
                    {
                        "host": host,
                        "checkouts": stat.checkouts,
                        "days": stat.days,
                        "last_seen_at": stat.last_seen_at.isoformat(),
                        "signals": stat.signals,
                    }
                    for host, stat in candidate.ready
                ],
                "blocked": [origin for origin, _ in candidate.blocked],
                "uncovered_after": [host for host, _ in candidate.uncovered_after],
            }
            for candidate in candidates
            if candidate.ready or candidate.blocked
        ],
        indent=2,
    )


@cli.command()
@typer_async
async def set_embed_hosts(
    execute: bool = typer.Option(
        False, help="Set the hosts (default: dry-run, list only)"
    ),
    min_checkouts: int = typer.Option(
        20, help="Least embedded checkouts a host needs before we would set it"
    ),
    min_days: int = typer.Option(
        1, help="Least separate days a host must have been seen on"
    ),
    max_hosts: int = typer.Option(
        5, help="Most hosts to set for one organization, busiest first"
    ),
    window_days: int = typer.Option(
        EMBED_ORIGIN_WINDOW.days, help="How far back to look for embed origins"
    ),
    stale_days: int = typer.Option(
        30, help="A held-back host seen within this many days still counts as live"
    ),
    include_local: bool = typer.Option(
        False, help="Also set local hosts such as localhost:3000"
    ),
    require_signal: bool = typer.Option(
        False, help="Only set hosts the merchant vouched for off the checkout path"
    ),
    rdap: bool = typer.Option(
        False, help="Ask the registries whether an unvouched host is theirs too"
    ),
    limit: int = typer.Option(0, help="Stop after this many organizations (0: all)"),
    slug: list[str] = typer.Option(
        [], help="Only these organizations, repeatable. Indexed, so it is fast."
    ),
    command_timeout: float = typer.Option(
        600.0, help="Seconds the scan may take before the driver cancels it"
    ),
    json: bool = typer.Option(False, help="Print the result as JSON and nothing else"),
    verbose: bool = typer.Option(False, help="Also list the hosts held back"),
) -> None:
    since = datetime.now(UTC) - timedelta(days=window_days)
    read_engine = _read_engine(command_timeout)

    try:
        async with create_async_sessionmaker(read_engine)() as session:
            if not slug and not json:
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
            min_days=min_days,
            max_hosts=max_hosts,
            include_local=include_local,
            require_signal=require_signal,
            stale_days=stale_days,
        )

    ranked = sorted(candidates.values(), key=lambda c: c.embeds, reverse=True)
    if limit:
        ranked = ranked[:limit]

    if rdap:
        await _apply_rdap([c for c in ranked if c.ready])

    if json:
        console.print_json(_as_json(ranked))
        return

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
            # Locked, and re-checked against the primary: the scan read a lagging
            # replica minutes ago, and an organization may have been deleted or
            # lost the capability since.
            organizations = {
                organization.id: organization
                for organization in (
                    await session.execute(
                        select(Organization)
                        .where(
                            Organization.id.in_(
                                [c.organization_id for c in actionable]
                            ),
                            Organization.deleted_at.is_(None),
                            Organization.can_accept_payments,
                        )
                        .with_for_update()
                    )
                )
                .scalars()
                .all()
            }

            updated = 0
            for candidate in actionable:
                organization = organizations.get(candidate.organization_id)
                if organization is None:
                    console.print(
                        f"[yellow]{candidate.slug}: no longer takes payments, "
                        "left alone."
                    )
                    continue
                # A merchant who edited their own list while we scanned has
                # answered for themselves.
                if organization.embed_hosts != candidate.current_hosts:
                    console.print(
                        f"[yellow]{candidate.slug}: list changed since the scan, "
                        "left alone."
                    )
                    continue
                hosts = [*organization.embed_hosts, *(h for h, _ in candidate.ready)]
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

            still = [c for c in actionable if c.uncovered_after]
            if still:
                console.print(
                    "\n[yellow]Written, but still embedding from hosts nobody "
                    "listed — they break anyway:"
                )
                for candidate in still:
                    remaining = ", ".join(host for host, _ in candidate.uncovered_after)
                    console.print(f"  {candidate.slug}: {remaining}")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
