"""Activity definitions as the deployment configuration stores them."""

from collections.abc import Mapping
from typing import Any

from .schemas import DeployActivity


def activities_of(configuration: Mapping[str, Any] | None) -> dict[str, DeployActivity]:
    """The classifiers one configuration declares, by slug; empty without one."""
    if configuration is None:
        return {}
    return {
        item.slug: item
        for item in (
            DeployActivity.model_validate(raw)
            for raw in configuration.get("activities", [])
        )
    }
