from collections.abc import Sequence

from polar.models import VoidSense


def senses_in_version(
    senses: Sequence[VoidSense], version_id: str | None
) -> dict[str, VoidSense]:
    return {sense.slug: sense for sense in senses if sense.version_id == version_id}
