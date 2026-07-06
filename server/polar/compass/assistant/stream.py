"""
Run the assistant agent and turn it into an SSE event stream.

Events, in order of appearance:
- `text`   {"delta": str}         — model output, streamed as it generates
- `block`  {<AssistantBlock>}     — a renderable block produced by a tool
- `done`   {"message_history": str} — opaque state to send back next turn
- `error`  {"message": str}
"""

import json
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

from polar.logging import Logger

from .deps import AssistantDeps

log: Logger = structlog.get_logger()


def _event(event: str, data: Any) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data)}


async def stream_assistant_run(
    agent: Agent[AssistantDeps, str],
    deps: AssistantDeps,
    prompt: str,
    message_history_json: str | None,
) -> AsyncGenerator[dict[str, str]]:
    history = None
    if message_history_json:
        try:
            history = ModelMessagesTypeAdapter.validate_json(message_history_json)
        except ValueError:
            yield _event("error", {"message": "Invalid message history."})
            return

    emitted_blocks = 0

    def flush_blocks() -> list[dict[str, str]]:
        nonlocal emitted_blocks
        fresh = deps.blocks[emitted_blocks:]
        emitted_blocks = len(deps.blocks)
        return [_event("block", block.model_dump(mode="json")) for block in fresh]

    try:
        async with agent.iter(prompt, deps=deps, message_history=history) as run:
            async for node in run:
                # Blocks appear when a tools node executes (i.e. between loop
                # iterations); forward any new ones before the next node.
                for block_event in flush_blocks():
                    yield block_event

                if Agent.is_model_request_node(node):
                    async with node.stream(run.ctx) as request_stream:
                        async for event in request_stream:
                            if isinstance(event, PartStartEvent) and isinstance(
                                event.part, TextPart
                            ):
                                if event.part.content:
                                    yield _event("text", {"delta": event.part.content})
                            elif isinstance(event, PartDeltaEvent) and isinstance(
                                event.delta, TextPartDelta
                            ):
                                if event.delta.content_delta:
                                    yield _event(
                                        "text", {"delta": event.delta.content_delta}
                                    )

            for block_event in flush_blocks():
                yield block_event

            result = run.result
            assert result is not None
            yield _event(
                "done",
                {
                    "message_history": ModelMessagesTypeAdapter.dump_json(
                        result.all_messages()
                    ).decode()
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
