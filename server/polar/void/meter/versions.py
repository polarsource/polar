from collections.abc import Sequence

from polar.models import Meter as MeterModel


def meters_in_version(
    meters: Sequence[MeterModel], version_id: str | None
) -> dict[str, MeterModel]:
    """The meters of one configuration version by slug; empty without a version."""
    return {meter.slug: meter for meter in meters if meter.version_id == version_id}
