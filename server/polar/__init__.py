from pkgutil import extend_path
from typing import TYPE_CHECKING, Any

__path__ = extend_path(__path__, __name__)

_SDK_EXPORTS = frozenset(
    {
        "PolarError",
        "PolarNetworkError",
        "PolarRateLimitError",
        "PolarServerError",
        "deserialize",
    }
)

if TYPE_CHECKING:
    from polar.base import PolarError as PolarError
    from polar.base import PolarNetworkError as PolarNetworkError
    from polar.base import PolarRateLimitError as PolarRateLimitError
    from polar.base import PolarServerError as PolarServerError
    from polar.base import deserialize as deserialize


def __getattr__(name: str) -> Any:
    if name in _SDK_EXPORTS:
        from polar import base

        return getattr(base, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# Merge queue test
