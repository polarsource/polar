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
    - REVIEW, OFFBOARDING: warning (yellow)
    - ACTIVE, SNOOZED, DENIED, CREATED: ghost (gray)

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
        OrganizationStatus.ACTIVE: {
            "class": "badge-ghost border border-base-300",
            "aria": "active status",
        },
        OrganizationStatus.REVIEW: {
            "class": "badge-warning",
            "aria": "review status",
        },
        OrganizationStatus.SNOOZED: {
            "class": "badge-ghost border border-base-300",
            "aria": "snoozed status",
        },
        OrganizationStatus.DENIED: {
            "class": "badge-ghost border border-base-300",
            "aria": "denied status",
        },
        OrganizationStatus.BLOCKED: {
            "class": "badge-error",
            "aria": "blocked status",
        },
        OrganizationStatus.CREATED: {
            "class": "badge-ghost border border-base-300",
            "aria": "created status",
        },
        OrganizationStatus.OFFBOARDING: {
            "class": "badge-warning",
            "aria": "offboarding status",
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
