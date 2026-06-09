from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class BufferedEvent:
    """The shape the ported `matches()` logic expects, adapted from a stored event body.

    The sidecar buffers events as the raw JSON the caller posted, so a stored body has
    no `source` (upstream stamps it `user`) and keeps the input `metadata` key (which
    upstream exposes as `user_metadata`).
    """

    name: str
    source: str
    timestamp: datetime
    user_metadata: dict[str, Any]

    @classmethod
    def from_body(cls, body: dict[str, Any]) -> "BufferedEvent":
        return cls(
            name=body["name"],
            source=body.get("source", "user"),
            timestamp=datetime.fromisoformat(body["timestamp"]),
            user_metadata=body.get("metadata", {}),
        )
