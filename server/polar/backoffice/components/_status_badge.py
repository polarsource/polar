import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import classes, tag, text

from polar.models.organization import OrganizationStatus


@contextlib.contextmanager
def status_badge(
    status: OrganizationStatus,
    *,
    show_icon: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    """Create a status badge component with semantic coloring.

    Generates a badge element with appropriate styling based on organization status.
    Uses DaisyUI badge classes with semantic color mapping:
    - ACTIVE: success (green)
    - UNDER_REVIEW: warning (yellow)
    - DENIED: error (red)
    - CREATED, ONBOARDING_STARTED: secondary (gray)

    Args:
        status: The organization status to display.
        show_icon: If True, includes an icon/emoji indicator. Default False.
        **kwargs: Additional HTML attributes to pass to the badge element.

    Yields:
        None: Context manager yields control for optional additional badge content.

    Example:
        >>> with status_badge(OrganizationStatus.ACTIVE):
        ...     pass  # Displays "Active"
    """
    # Map status to badge variant with flat design
    status_config = {
        OrganizationStatus.CREATED: {
            "class": "badge-ghost border border-base-300",
            "aria": "created status",
        },
        OrganizationStatus.ONBOARDING_STARTED: {
            "class": "badge-ghost border border-base-300",
            "aria": "onboarding started status",
        },
        OrganizationStatus.READY: {
            "class": "badge-ghost border border-base-300",
            "aria": "ready status",
        },
        OrganizationStatus.FIRST_REVIEW: {
            "class": "badge-ghost border border-base-300",
            "aria": "first review status",
        },
        OrganizationStatus.ACTIVE: {
            "class": "badge-ghost border border-base-300",
            "aria": "active status",
        },
        OrganizationStatus.ONGOING_REVIEW: {
            "class": "badge-ghost border border-base-300",
            "aria": "ongoing review status",
        },
        OrganizationStatus.UNDER_REVIEW: {
            "class": "badge-ghost border border-base-300",
            "aria": "under review status",
        },
        OrganizationStatus.DENIED: {
            "class": "badge-ghost border border-base-300",
            "aria": "denied status",
        },
        OrganizationStatus.BLOCKED: {
            "class": "badge-ghost border border-base-300",
            "aria": "blocked status",
        },
    }

    config = status_config.get(
        status,
        {"class": "badge-ghost border border-base-300", "aria": "unknown status"},
    )

    with tag.span(classes="badge", **kwargs):
        classes(config["class"])
        if "aria-label" not in kwargs:
            kwargs["aria-label"] = config["aria"]

        text(status.get_display_name())
        yield


__all__ = ["status_badge"]
