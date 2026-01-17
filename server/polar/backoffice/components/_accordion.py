import contextlib
from collections.abc import Generator

from polar.backoffice.document import get_document


@contextlib.contextmanager
def item(accordion_name: str, title: str) -> Generator[None]:
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
        >>> with item("settings-accordion", "General Settings"):
        ...     with doc.p():
        ...         doc.text("Configuration options here")
        >>> with item("settings-accordion", "Advanced Settings"):
        ...     with doc.p():
        ...         doc.text("Advanced options here")
    """
    with doc.div(classes="collapse collapse-arrow bg-base-100 border border-base-300"):
        with doc.input(type="radio", name=accordion_name):
            pass
        with doc.div(classes="collapse-title font-semibold"):
            doc.text(title)
        with doc.div(classes="collapse-content"):
            yield


__all__ = ["item"]
