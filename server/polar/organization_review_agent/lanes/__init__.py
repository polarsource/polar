"""Lane registry stub.

Lanes are parallel investigation units the Investigate node fans out
to. Each lane is a small, focused agent that gathers facts for one
concern area (history, identity, payouts, etc.) and emits
:class:`RaisedSignal` records.

The full registry + per-context selection (Slice 7
``lanes_for_run(context)``) lands in subsequent slices. This module
exists today only so :class:`polar.organization_review_agent.lanes.base.Lane`
is importable.
"""

from .base import Lane, LaneRunContext, LaneRunResult

__all__ = ["Lane", "LaneRunContext", "LaneRunResult"]
