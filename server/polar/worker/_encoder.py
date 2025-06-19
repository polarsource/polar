import json
import uuid
from typing import Any

import dramatiq


def _json_obj_serializer(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class JSONEncoder(dramatiq.JSONEncoder):
    def encode(self, data: dict[str, Any]) -> bytes:
        return json.dumps(
            data, separators=(",", ":"), default=_json_obj_serializer
        ).encode("utf-8")
