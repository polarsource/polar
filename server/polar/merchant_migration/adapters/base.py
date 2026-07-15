from collections.abc import AsyncIterator
from typing import Protocol

from ..canonical import CanonicalAccount, CanonicalRecord


class SourceAdapter(Protocol):
    """Reads one billing provider into provider-agnostic CanonicalRecords.

    ``extract`` is an async iterator because source data can be huge and must be
    streamed, not materialized. Credential validation is provider-specific and
    lives on the concrete adapter (e.g. ``StripeAdapter.verify_scopes``), not here.
    """

    def extract(self) -> AsyncIterator[CanonicalRecord]: ...

    async def get_source_account(self) -> CanonicalAccount: ...
