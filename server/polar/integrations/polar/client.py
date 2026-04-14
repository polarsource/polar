from __future__ import annotations

from typing import TYPE_CHECKING, Any

from polar.config import settings
from polar.exceptions import PolarError as InternalPolarError

if TYPE_CHECKING:
    from polar.integrations.polar._impl import PolarSelfClient as PolarSelfClient


class PolarSelfClientError(InternalPolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


def __getattr__(name: str) -> Any:
    if name == "PolarSelfClient":
        from polar.integrations.polar._impl import PolarSelfClient

        globals()[name] = PolarSelfClient
        return PolarSelfClient
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


_client: PolarSelfClient | None = None


def get_client() -> PolarSelfClient:
    global _client
    if _client is None:
        from polar.integrations.polar._impl import PolarSelfClient

        _client = PolarSelfClient(
            access_token=settings.POLAR_ACCESS_TOKEN,
            api_url=settings.POLAR_API_URL,
        )
    return _client
