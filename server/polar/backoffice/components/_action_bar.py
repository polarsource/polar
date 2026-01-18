import contextlib
from collections.abc import Generator
from typing import Any, Literal

from markupflow import Fragment

Position = Literal["left", "center", "right", "between"]


@contextlib.contextmanager
def action_bar(
    *,
    position: Position = "right",
    vertical: bool = False,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create an action bar container for grouping buttons and actions.

    Generates a flex container for organizing action buttons with consistent
    spacing and alignment. Useful for form actions, card actions, or toolbar buttons.

    Args:
        position: Horizontal alignment of actions ("left", "center", "right", "between").
        vertical: If True, stacks actions vertically instead of horizontally.
        **kwargs: Additional HTML attributes.

    Yields:
        Fragment: The fragment for adding buttons/actions.

    Example:
        >>> with action_bar(position="right") as bar:
        ...     with bar.fragment(button(variant="primary")) as btn:
        ...         btn.text("Save")
        ...     with bar.fragment(button(variant="secondary")) as btn:
        ...         btn.text("Cancel")
    """
    justify_classes = {
        "left": "justify-start",
        "center": "justify-center",
        "right": "justify-end",
        "between": "justify-between",
    }

    direction_class = "flex-col" if vertical else "flex-row"
    gap_class = "gap-2" if not vertical else "gap-3"

    fragment = Fragment()
    with fragment.div(
        class_=f"flex {direction_class} items-center {gap_class} {justify_classes[position]}",
        **kwargs,
    ):
        yield fragment


__all__ = ["Position", "action_bar"]
