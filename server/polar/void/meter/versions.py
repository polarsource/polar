from collections.abc import Sequence

from polar.models import VoidMeter


def meters_in_version(
    meters: Sequence[VoidMeter], version_id: str | None
) -> dict[str, VoidMeter]:
    """The meters of one configuration version by slug; empty without a version."""
    return {meter.slug: meter for meter in meters if meter.version_id == version_id}
