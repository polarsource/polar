import contextlib
from collections.abc import Generator

from tagflow import attr, tag, text


@contextlib.contextmanager
def modal(title: str, *, open: bool = False) -> Generator[None]:
    """Create a modal dialog component using DaisyUI modal classes.

    Generates a modal dialog with a title, close button, and content area.
    The modal can be opened by default or controlled programmatically.
    It includes both a close button in the top-right corner and a backdrop
    click-to-close functionality.

    The modal structure includes:
    - Dialog element with DaisyUI modal classes
    - Modal box container with responsive sizing
    - Close button (X) in top-right corner
    - Modal title as an h3 heading
    - Content area for modal body
    - Backdrop overlay for click-to-close

    Args:
        title: The text to display in the modal header.
        open: If True, the modal will be open by default. If False,
            the modal will be closed and can be opened via JavaScript
            or HTMX interactions.

    Yields:
        None: Context manager yields control for modal body content.

    Example:
        >>> with modal("Confirm Delete", open=True):
        ...     with tag.p():
        ...         text("Are you sure you want to delete this item?")
        ...     with tag.div(classes="modal-action"):
        ...         with button(variant="error"):
        ...             text("Delete")
        # Generates an open modal with title and content
    """
    with tag.dialog(classes="modal modal-bottom sm:modal-middle"):
        if open:
            attr("open", True)
        with tag.div(classes="modal-box"):
            with tag.form(method="dialog"):
                with tag.button(
                    classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with tag.div(classes="icon-x"):
                        pass
            with tag.h3(classes="text-lg font-bold mb-4"):
                text(title)
            yield
        with tag.form(method="dialog", classes="modal-backdrop"):
            with tag.button():
                pass


__all__ = ["modal"]
