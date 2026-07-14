import json
from typing import Any

import dramatiq

from polar.kit.json import json_obj_serializer


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
            data, separators=(",", ":"), default=json_obj_serializer
        ).encode("utf-8")
