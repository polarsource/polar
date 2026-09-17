from collections.abc import Sequence

from polar.models import VoidActivity


def activities_in_version(
    activities: Sequence[VoidActivity], version_id: str | None
) -> dict[str, VoidActivity]:
    return {
        activity.slug: activity
        for activity in activities
        if activity.version_id == version_id
    }
