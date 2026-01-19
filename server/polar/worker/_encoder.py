import json
import uuid
from typing import Any

import dramatiq


def _json_obj_serializer(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class JSONEncoder(dramatiq.JSONEncoder):
    def __init__(self, broker: dramatiq.Broker | None = None) -> None:
        self._ephemeral_options: set[str] = set()
        if broker is not None:
            for middleware in broker.middleware:
                self._ephemeral_options = self._ephemeral_options | getattr(
                    middleware, "ephemeral_options", set()
                )

    def encode(self, data: dict[str, Any]) -> bytes:
        if options := data.get("options"):
            data = {
                **data,
                "options": {
                    k: v for k, v in options.items() if k not in self._ephemeral_options
                },
            }
        return json.dumps(
            data, separators=(",", ":"), default=_json_obj_serializer
        ).encode("utf-8")
