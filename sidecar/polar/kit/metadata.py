# Source: server/polar/kit/metadata.py (get_nested_metadata_value, verbatim)
from typing import Any


def get_nested_metadata_value(data: dict[str, Any], property_path: str) -> Any:
    """Get a value from a nested dict using a dot-notation path; None if absent."""
    if not property_path:
        return None

    parts = property_path.split(".")
    value: Any = data
    for part in parts:
        if not isinstance(value, dict):
            return None
        value = value.get(part)
        if value is None:
            return None
    return value
