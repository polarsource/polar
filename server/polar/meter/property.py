from typing import Annotated

from pydantic import AfterValidator, ValidationInfo

MAX_PROPERTY_LENGTH = 255
MAX_PROPERTY_DEPTH = 5

STORED_CONTEXT = {"stored": True}


def _strip_metadata_prefix(value: str) -> str:
    prefix = "metadata."
    return value.removeprefix(prefix)


def _validate_property_bounds(value: str, info: ValidationInfo) -> str:
    # Already-persisted values predate these bounds; don't fail on loading them.
    if info.context is not None and info.context.get("stored"):
        return value
    if len(value) > MAX_PROPERTY_LENGTH:
        raise ValueError(
            f"Property must be at most {MAX_PROPERTY_LENGTH} characters long."
        )
    if value.count(".") + 1 > MAX_PROPERTY_DEPTH:
        raise ValueError(f"Property must be at most {MAX_PROPERTY_DEPTH} levels deep.")
    return value


PropertyPath = Annotated[
    str,
    AfterValidator(_strip_metadata_prefix),
    AfterValidator(_validate_property_bounds),
]
