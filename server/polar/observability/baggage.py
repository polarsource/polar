from collections.abc import Iterator
from contextlib import contextmanager

import logfire


@contextmanager
def organization_baggage(
    organization_id: str | None = None,
    organization_slug: str | None = None,
) -> Iterator[None]:
    """Propagate organization identity as OTel baggage. None values are skipped."""
    values: dict[str, str] = {}
    if organization_id:
        values["organization_id"] = organization_id
    if organization_slug:
        values["organization_slug"] = organization_slug
    with logfire.set_baggage(**values):
        yield
