"""
Run the assistant agent and turn it into an SSE event stream.

Events, in order of appearance:
- `text`   {"delta": str}         — model output, streamed as it generates
- `block`  {<AssistantBlock>}     — a renderable block, placed by the model
- `done`   {"message_history": str} — opaque state to send back next turn
- `error`  {"message": str}
"""

import hashlib
import hmac
import json
import re
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from pydantic_ai import Agent
from pydantic_ai.messages import (
    ModelMessagesTypeAdapter,
    PartDeltaEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
)

from polar.config import settings
from polar.integrations.polar.service import polar_self
from polar.logging import Logger
from polar.organization_review.schemas import UsageInfo

from .deps import AssistantDeps

log: Logger = structlog.get_logger()


def _event(event: str, data: Any) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data)}


def _track_usage(
    deps: AssistantDeps, usage: Any, model_provider: str, model_name: str
) -> None:
    """Polar-for-Polar dogfooding: ingest this run's inference cost as a span
    on the Polar organization, mirroring organization reviews. Best-effort —
    tracking must never break the conversation."""
    try:
        info = UsageInfo.from_agent_usage(usage, model_provider, model_name)
        polar_self.enqueue_track_compass_assistant_usage(
            external_customer_id=str(deps.organization_id),
            vendor=model_provider,
            model=model_name,
            input_tokens=info.input_tokens,
            output_tokens=info.output_tokens,
            cost_usd=info.estimated_cost_usd,
        )
    except Exception:
        log.exception(
            "compass.assistant_usage_tracking_error",
            organization_id=str(deps.organization_id),
        )


def _scopes_digest(deps: AssistantDeps) -> str:
    joined = ",".join(sorted(scope.value for scope in deps.auth_subject.scopes))
    return hashlib.sha256(joined.encode()).hexdigest()


def _history_mac(organization_id: str, scopes: str, messages: str) -> str:
    payload = f"{organization_id}|{scopes}|{messages}".encode()
    return hmac.new(settings.SECRET.encode(), payload, hashlib.sha256).hexdigest()


def seal_history(deps: AssistantDeps, messages_json: str) -> str:
    """Bind conversation state to the caller's organization and scopes.

    The state round-trips through the client, so it is signed with claims:
    replaying it against another organization, or after the token's scopes
    changed, fails verification instead of leaking prior context (including
    old tool results) into a conversation it does not belong to.
    """
    organization_id = str(deps.organization_id)
    scopes = _scopes_digest(deps)
    return json.dumps(
        {
            "org": organization_id,
            "scopes": scopes,
            "messages": messages_json,
            "mac": _history_mac(organization_id, scopes, messages_json),
        }
    )


def open_history(deps: AssistantDeps, sealed: str) -> str | None:
    """The messages JSON if the seal verifies for this caller, else None."""
    try:
        envelope = json.loads(sealed)
        organization_id = envelope["org"]
        scopes = envelope["scopes"]
        messages = envelope["messages"]
        mac = envelope["mac"]
    except (ValueError, TypeError, KeyError):
        return None
    if not hmac.compare_digest(mac, _history_mac(organization_id, scopes, messages)):
        return None
    if organization_id != str(deps.organization_id):
        return None
    if scopes != _scopes_digest(deps):
        return None
    return str(messages)


_MARKER_RE = re.compile(r"\s*\[block:(\d+)\]\s*")
_MARKER_PREFIX = "[block:"
_MAX_MARKER_LEN = 12


class _BlockPlacer:
    """Splits streamed text around `[block:N]` placement markers.

    Text before a marker flows through as-is; the marker itself becomes a
    block reference. A possible partial marker at the end of a delta is held
    back until the next delta resolves it.
    """

    def __init__(self) -> None:
        self._buffer = ""

    def feed(self, delta: str) -> list[tuple[str, str | int]]:
        self._buffer += delta
        out: list[tuple[str, str | int]] = []
        while True:
            match = _MARKER_RE.search(self._buffer)
            if match:
                if pre := self._buffer[: match.start()]:
                    out.append(("text", pre))
                out.append(("block", int(match.group(1))))
                self._buffer = self._buffer[match.end() :]
                continue
            cut = self._buffer.rfind("[")
            if cut != -1:
                candidate = self._buffer[cut:]
                partial = _MARKER_PREFIX.startswith(candidate) or (
                    candidate.startswith(_MARKER_PREFIX)
                    and len(candidate) <= _MAX_MARKER_LEN
                )
                if partial:
                    if safe := self._buffer[:cut]:
                        out.append(("text", safe))
                    self._buffer = candidate
                    return out
            if self._buffer:
                out.append(("text", self._buffer))
                self._buffer = ""
            return out

    def flush(self) -> str:
        tail, self._buffer = self._buffer, ""
        return tail


async def stream_assistant_run(
    agent: Agent[AssistantDeps, str],
    deps: AssistantDeps,
    prompt: str,
    message_history_json: str | None,
    *,
    model_provider: str,
    model_name: str,
) -> AsyncGenerator[dict[str, str]]:
    history = None
    if message_history_json:
        messages_json = open_history(deps, message_history_json)
        if messages_json is None:
            yield _event(
                "error",
                {
                    "message": "This conversation state is invalid or from a "
                    "different context. Start a new conversation."
                },
            )
            return
        try:
            history = ModelMessagesTypeAdapter.validate_json(messages_json)
        except ValueError:
            yield _event("error", {"message": "Invalid message history."})
            return

    placer = _BlockPlacer()
    placed: set[int] = set()

    def block_event(index: int) -> dict[str, str] | None:
        # Markers are 1-based indexes into the run's prepared blocks.
        if index in placed or not (1 <= index <= len(deps.blocks)):
            return None
        placed.add(index)
        return _event("block", deps.blocks[index - 1].model_dump(mode="json"))

    def placed_events(delta: str) -> list[dict[str, str]]:
        events: list[dict[str, str]] = []
        for kind, value in placer.feed(delta):
            if kind == "text":
                events.append(_event("text", {"delta": str(value)}))
            else:
                placed_block = block_event(int(value))
                if placed_block is not None:
                    events.append(placed_block)
        return events

    try:
        async with agent.iter(prompt, deps=deps, message_history=history) as run:
            async for node in run:
                if Agent.is_model_request_node(node):
                    async with node.stream(run.ctx) as request_stream:
                        async for event in request_stream:
                            if isinstance(event, PartStartEvent) and isinstance(
                                event.part, TextPart
                            ):
                                if event.part.content:
                                    for out in placed_events(event.part.content):
                                        yield out
                            elif isinstance(event, PartDeltaEvent) and isinstance(
                                event.delta, TextPartDelta
                            ):
                                if event.delta.content_delta:
                                    for out in placed_events(event.delta.content_delta):
                                        yield out
                    if tail := placer.flush():
                        yield _event("text", {"delta": tail})

            # Fallback: blocks the model never placed still reach the user,
            # after the text.
            for index in range(1, len(deps.blocks) + 1):
                unplaced = block_event(index)
                if unplaced is not None:
                    yield unplaced

            result = run.result
            assert result is not None
            _track_usage(deps, result.usage, model_provider, model_name)
            yield _event(
                "done",
                {
                    "message_history": seal_history(
                        deps,
                        ModelMessagesTypeAdapter.dump_json(
                            result.all_messages()
                        ).decode(),
                    )
                },
            )
    except Exception:
        log.exception(
            "compass.assistant_error", organization_id=str(deps.organization_id)
        )
        yield _event(
            "error",
            {"message": "The assistant hit an unexpected error. Try again."},
        )
