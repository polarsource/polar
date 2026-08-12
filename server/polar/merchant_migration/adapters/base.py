from collections.abc import AsyncIterator
from typing import Protocol

from ..canonical import CanonicalAccount, CanonicalRecord, CanonicalSubscription


class SourceAdapter(Protocol):
    """Reads one billing provider into provider-agnostic CanonicalRecords.

    ``extract`` is an async iterator because source data can be huge and must be
    streamed, not materialized. Credential validation is provider-specific and
    lives on the concrete adapter (e.g. ``StripeAdapter.verify_scopes``), not here.

    Everything here reads, except ``stop_source_subscription``: the one write the
    migration makes on the merchant's own provider, at cutover.
    """

    def extract(self) -> AsyncIterator[CanonicalRecord]: ...

    async def get_source_account(self) -> CanonicalAccount: ...

    async def get_subscription(self, source_id: str) -> CanonicalSubscription | None:
        """The source subscription as it stands now, or None if it's gone.

        Weeks can pass between the import and the cutover, so the cutover reads
        the source again rather than trusting the staged copy.
        """
        ...

    async def stop_source_subscription(self, source_id: str, *, reference: str) -> None:
        """Stop billing this subscription on the source, for good.

        ``reference`` identifies the migration and is recorded on the source, so
        a later read can tell our own cancellation apart from the customer
        having churned (see ``CanonicalSubscription.stopped_for_migration``).
        """
        ...
