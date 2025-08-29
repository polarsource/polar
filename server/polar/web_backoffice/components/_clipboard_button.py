import contextlib
from collections.abc import Generator
from typing import Literal

from tagflow import tag

Variant = Literal[
    "neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"
]
Size = Literal["xs", "sm", "md", "lg", "xl"]


@contextlib.contextmanager
def clipboard_button(text: str) -> Generator[None]:
    """Create a button that copies text to the user's clipboard when clicked.

    Generates a button with clipboard icons that uses Hyperscript to copy the provided
    text to the clipboard. The button shows visual feedback by switching from a
    clipboard icon to a checkmark icon for 5 seconds after successful copying.

    The button uses the CopyToClipboard behavior defined in the base template,
    which handles the clipboard API interaction and visual state changes.

    Args:
        text: The text content to copy to the clipboard when the button is clicked.

    Example:
        >>> with clipboard_button("secret-api-key-123"):
        ...     pass
    """
    with tag.button(
        type="button",
        classes="font-normal cursor-pointer",
        _=f"install CopyToClipboard(text: '{text}')",
    ):
        with tag.div(classes="icon-clipboard"):
            pass
        with tag.div(classes="icon-clipboard-check hidden"):
            pass
    yield


__all__ = ["clipboard_button"]
