from typing import Any, Protocol

from ..canonical import CanonicalAccount, CanonicalRecord, CanonicalSubscription


class SourceAdapter(Protocol):
    """Reads one billing provider into provider-agnostic CanonicalRecords.

    ``extract_batch`` pages the source under a cursor so precheck can run as
    Dramatiq batches. Credential validation is provider-specific and lives on
    the concrete adapter (e.g. ``StripeAdapter.verify_scopes``), not here.

    Everything here reads, except ``stop_source_subscription``: the one write the
    migration makes on the merchant's own provider, at cutover.
    """

    async def extract_batch(
        self, *, cursor: dict[str, Any] | None, limit: int
    ) -> tuple[list[CanonicalRecord], dict[str, Any] | None]:
        """Return up to ``limit`` records and the next cursor (None when done)."""
        ...

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
