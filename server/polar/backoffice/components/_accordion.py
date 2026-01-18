import contextlib
from collections.abc import Generator

from markupflow import Fragment


@contextlib.contextmanager
def item(accordion_name: str, title: str) -> Generator[Fragment]:
    """Create an accordion item component using DaisyUI collapse styling.

    Generates a collapsible accordion item with a radio button control mechanism.
    Items with the same accordion_name will behave as a radio group, where only
    one item can be expanded at a time. The component uses DaisyUI's collapse
    classes for styling and behavior.

    Args:
        accordion_name: The name attribute for the radio input, used to group
            accordion items together. Items with the same name will form a
            mutually exclusive group.
        title: The text to display in the accordion header/title area.

    Example:
        >>> with item("settings-accordion", "General Settings") as accordion:
        ...     with accordion.p():
        ...         accordion.text("Configuration options here")
        >>> with item("settings-accordion", "Advanced Settings") as accordion:
        ...     with accordion.p():
        ...         accordion.text("Advanced options here")
    """
    fragment = Fragment()
    with fragment.div(class_="collapse collapse-arrow bg-base-100 border border-base-300"):
        with fragment.input(type="radio", name=accordion_name):
            pass
        with fragment.div(class_="collapse-title font-semibold"):
            fragment.text(title)
        with fragment.div(class_="collapse-content"):
            yield fragment


__all__ = ["item"]
