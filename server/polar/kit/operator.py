from typing import Any


def attrgetter(
    obj: Any, attr: tuple[str, ...], default: Any | None = None
) -> Any | None:
    for a in attr:
        try:
            obj = getattr(obj, a)
        except AttributeError:
            return default
    return obj
