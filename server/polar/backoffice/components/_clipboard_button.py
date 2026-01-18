import contextlib
from collections.abc import Generator
from typing import Literal

from markupflow import Fragment

Variant = Literal[
    "neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"
]
Size = Literal["xs", "sm", "md", "lg", "xl"]


@contextlib.contextmanager
def clipboard_button(text: str) -> Generator[Fragment]:
    """Create a button that copies text to the user's clipboard when clicked.

    Generates a button with clipboard icons that uses Hyperscript to copy the provided
    text to the clipboard. The button shows visual feedback by switching from a
    clipboard icon to a checkmark icon for 5 seconds after successful copying.

    The button uses the CopyToClipboard behavior defined in the base template,
    which handles the clipboard API interaction and visual state changes.

    Args:
        text: The text content to copy to the clipboard when the button is clicked.

    Example:
        >>> with clipboard_button("secret-api-key-123") as cb:
        ...     pass
    """
    fragment = Fragment()
    with fragment.button(
        type="button",
        class_="font-normal cursor-pointer",
        _=f"install CopyToClipboard(text: '{text}')",
    ):
        with fragment.div(class_="icon-clipboard"):
            pass
        with fragment.div(class_="icon-clipboard-check hidden"):
            pass
    yield fragment


__all__ = ["clipboard_button"]
