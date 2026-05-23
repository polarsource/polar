"""Lane protocol.

A lane is a focused investigator: deterministic data pull or small LLM
sub-agent that, for a single concern area, produces structured facts
plus zero or more :class:`RaisedSignal` records. Lanes run concurrently
under the Investigate node.

The :class:`Lane` protocol is intentionally tiny so adding a new lane
is a one-file drop-in. Per-context registry lookup
(``lanes_for_run(context)``) and parallelism are the graph's
responsibility, not each lane's.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from polar.models.organization import Organization
from polar.postgres import AsyncSession

from ..schemas import LaneFacts, RaisedSignal


@dataclass(slots=True)
class LaneRunContext:
    """Non-serialisable handles a lane receives at run time.

    Kept separate from :class:`polar.organization_review_agent.schemas.ReviewState`
    so the state can round-trip JSONB cleanly. The graph constructs
    one of these per node entry; lanes do not hold references after
    returning.
    """

    organization: Organization
    session: AsyncSession
    review_context: str
    """The legacy ``ReviewContext`` value (string) the run was started under."""


@dataclass(slots=True)
class LaneRunResult:
    """What a lane returns from a single run.

    Both fields are committed to state on the caller's side; the lane
    does not write to the database itself.
    """

    facts: LaneFacts
    signals: list[RaisedSignal]


@runtime_checkable
class Lane(Protocol):
    """A lane: one focused investigator.

    Implementations are typically a singleton class with this shape::

        class HistoryLane:
            name: ClassVar[str] = "history"

            async def is_enabled(self, ctx: LaneRunContext) -> bool:
                return True

            async def run(self, ctx: LaneRunContext) -> LaneRunResult:
                ...

    The graph instantiates one Lane per concern area and uses it across
    runs — keep state internal-only or per-call, never per-organisation.
    """

    name: str
    """Snake_case identifier. Must match a ``owner_lane`` value used in
    :data:`polar.organization_review_agent.taxonomy.SIGNAL_KIND_REGISTRY`."""

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        """Return False to skip this lane for the current run.

        Cheap predicate evaluated before :meth:`run` to keep cost +
        rate-limit budget down. ``await``-able so lanes that need to
        peek at, say, payment counts before deciding to investigate can.
        """
        ...

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        """Gather facts and emit signals.

        Implementations should be idempotent (the graph may re-enter
        nodes on resume after worker restart) and pure with respect to
        external state — lanes don't write to the DB, send messages, or
        mutate ``ctx.organization``.
        """
        ...


def assert_known_lane_name(name: str, registered: set[str]) -> None:
    """Tiny helper for tests + graph wiring.

    Surfaces typos in lane names early. Used by Slice 0's
    ``test_taxonomy::test_owner_lane_names_are_consistent`` and by the
    Investigate node when checking ``state.lanes_enabled`` before fan-out.

    ``registered`` is the set of lane names available at the call site.
    The Slice 0 ship has no actual lanes; this helper is exercised in
    tests via a small fake registry.
    """

    if name not in registered:
        raise ValueError(
            f"Unknown lane name {name!r}; registered lanes are "
            f"{sorted(registered)}."
        )


_LANE_NAME_PLACEHOLDER: list[str] = []
"""Tracks lane names that have been registered.

Empty in Slice 0; Slice 0 lanes (history, identity, payments, …) will
append their ``Lane.name`` here when imported. Kept private — callers
should treat this as an implementation detail of the lane registry,
which is fleshed out in a later slice.

Centralising the list early makes the migration easier: the graph + the
auto-action gate (Slice 1) + the routing predicates (Slice 3) all need
a single place to ask "is X a real lane name?", and this is it.
"""


def _register_lane_name(name: str) -> None:
    if name in _LANE_NAME_PLACEHOLDER:
        raise RuntimeError(f"Lane name {name!r} registered twice")
    _LANE_NAME_PLACEHOLDER.append(name)


def registered_lane_names() -> tuple[str, ...]:
    """Snapshot of registered lane names, for tests + assertions."""

    return tuple(_LANE_NAME_PLACEHOLDER)


__all__ = [
    "Lane",
    "LaneRunContext",
    "LaneRunResult",
    "assert_known_lane_name",
    "registered_lane_names",
]
