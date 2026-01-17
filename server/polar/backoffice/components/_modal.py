import contextlib
from collections.abc import Generator

from polar.backoffice.document import get_document


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
        ...     with doc.p():
        ...         doc.text("Are you sure you want to delete this item?")
        ...     with doc.div(classes="modal-action"):
        ...         with button(variant="error"):
        ...             doc.text("Delete")
        # Generates an open modal with title and content
    """
    with doc.dialog(classes="modal modal-bottom sm:modal-middle"):
        if open:
            doc.attr("open", True)
        with doc.div(classes="modal-box"):
            with doc.form(method="dialog"):
                with doc.button(
                    classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with doc.div(classes="icon-x"):
                        pass
            with doc.h3(classes="text-lg font-bold mb-4"):
                doc.text(title)
            yield
        with doc.form(method="dialog", classes="modal-backdrop"):
            with doc.button():
                pass


__all__ = ["modal"]
