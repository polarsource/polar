from collections.abc import AsyncIterator
from typing import Protocol

from ..canonical import CanonicalRecord


class SourceAdapter(Protocol):
    """Reads one billing provider into provider-agnostic CanonicalRecords.

    ``extract`` is an async iterator because source data can be huge and must be
    streamed, not materialized.
    """

    def extract(self) -> AsyncIterator[CanonicalRecord]: ...
