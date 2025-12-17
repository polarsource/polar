import contextlib
from collections.abc import Generator
from typing import Any, Literal

from tagflow import tag

Position = Literal["left", "center", "right", "between"]


@contextlib.contextmanager
def action_bar(
    *,
    position: Position = "right",
    vertical: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    """Create an action bar container for grouping buttons and actions.

    Generates a flex container for organizing action buttons with consistent
    spacing and alignment. Useful for form actions, card actions, or toolbar buttons.

    Args:
        position: Horizontal alignment of actions ("left", "center", "right", "between").
        vertical: If True, stacks actions vertically instead of horizontally.
        **kwargs: Additional HTML attributes.

    Yields:
        None: Context manager yields control for button/action content.

    Example:
        >>> with action_bar(position="right"):
        ...     with button(variant="primary"):
        ...         text("Save")
        ...     with button(variant="secondary"):
        ...         text("Cancel")
    """
    justify_classes = {
        "left": "justify-start",
        "center": "justify-center",
        "right": "justify-end",
        "between": "justify-between",
    }

    direction_class = "flex-col" if vertical else "flex-row"
    gap_class = "gap-2" if not vertical else "gap-3"

    with tag.div(
        classes=f"flex {direction_class} items-center {gap_class} {justify_classes[position]}",
        **kwargs,
    ):
        yield


__all__ = ["Position", "action_bar"]
